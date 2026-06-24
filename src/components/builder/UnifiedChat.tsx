import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { ChevronDown, ChevronUp, Radio, Send, ShieldCheck } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { chatWithAgent, sendBuilderCommand, type AgentSlug } from "@/lib/hostflow-api";
import { PROJECTS } from "@/lib/projects";
import { loadWorkspace, patchWorkspace, supabaseLabelFor, type ChatMsg } from "@/lib/project-workspace";
import {
  subscribeThread,
  fetchThreadMessages,
  extractText,
  cleanAgentText,
  UNIFIED_CHAT_SLUGS,
} from "@/lib/agent-stream";

type Agent = "founder" | "jimmy" | "sherlock";
type Msg = ChatMsg;

// Phase 6 LOCKED limits
const MAX_CHARS = 5_000_000; // 5M chars per message
const MAX_ATTACHMENTS = 10_000;

const SEED: Msg[] = [
  { id: "1", agent: "founder", text: "Phase 1 shell ready ho gaya. Let's see the unified chat in action." },
  { id: "2", agent: "jimmy",   text: "Roger that. Frontend orchestration online. Sherlock standing by for code review and auto-fix loops." },
  { id: "3", agent: "sherlock", text: "Diagnostics nominal. No errors in the bridge. Awaiting first build instruction." },
];

const AGENT_META: Record<Agent, { name: string; subtitle: string; rail: string; chip: string; ring: string; initial: string }> = {
  founder:  { name: "Founder",  subtitle: "Operator",       rail: "bg-white shadow-[0_0_18px_rgba(255,255,255,0.6)]",          chip: "bg-white/[0.08] text-white border-white/20",             ring: "ring-white/30",      initial: "F" },
  jimmy:    { name: "Jimmy",    subtitle: "Build Agent",    rail: "bg-[#E50914] shadow-[0_0_18px_#E50914]",                    chip: "bg-[#E50914]/15 text-[#ff7480] border-[#E50914]/40",     ring: "ring-[#E50914]/50",  initial: "J" },
  sherlock: { name: "Sherlock", subtitle: "Review · Audit", rail: "bg-[#7c3aed] shadow-[0_0_18px_#7c3aed]",                    chip: "bg-[#7c3aed]/15 text-[#c4a8ff] border-[#7c3aed]/40",     ring: "ring-[#7c3aed]/50",  initial: "S" },
};

export default function UnifiedChat() {
  const { project, branch, environment, bridgeStatus } = useBuilder();
  const activeProject = PROJECTS.find((p) => p.id === project)!;

  // Phase 7 — per-project independent chat history.
  const [messages, setMessages] = useState<Msg[]>(() => {
    const ws = loadWorkspace(project, SEED);
    return ws.messages.length ? ws.messages : SEED;
  });
  const [fixIteration, setFixIteration] = useState<number>(() => loadWorkspace(project, SEED).fixLoopIteration);
  const [threadId, setThreadId] = useState<string | undefined>(() => loadWorkspace(project, SEED).jimmyThreadId);
  const [draft, setDraft] = useState("");
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const pendingPlaceholderRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // Re-hydrate when project switches.
  useEffect(() => {
    const ws = loadWorkspace(project, SEED);
    setMessages(ws.messages.length ? ws.messages : SEED);
    setFixIteration(ws.fixLoopIteration);
    setThreadId(ws.jimmyThreadId);
    seenMessageIdsRef.current = new Set();
  }, [project]);

  // Persist messages + fix-loop state per project.
  useEffect(() => {
    patchWorkspace(project, { messages, fixLoopIteration: fixIteration, jimmyThreadId: threadId });
  }, [project, messages, fixIteration, threadId]);

  // Always-snap-to-bottom on new message (butter-smooth via virtuoso)
  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: "smooth", align: "end" });
  }, [messages.length]);

  // Phase A.1 — Supabase 3 Realtime: subscribe to this project's Jimmy thread.
  // Worker on `axonetis-builder` inserts assistant + sherlock rows; they land here.
  useEffect(() => {
    if (!threadId) return;
    // Backfill historic messages once per thread switch.
    void fetchThreadMessages(threadId).then((rows) => {
      rows.forEach((r) => seenMessageIdsRef.current.add(r.id));
    });
    const unsub = subscribeThread(threadId, {
      onMessage: (row) => {
        if (seenMessageIdsRef.current.has(row.id)) return;
        seenMessageIdsRef.current.add(row.id);
        if (row.role !== "agent") return;
        const slug = (row.agent_slug ?? "jimmy") as AgentSlug;
        if (!UNIFIED_CHAT_SLUGS.has(slug)) return; // 8 advisors stay out of unified chat
        const text = extractText(row) || "(empty reply)";
        const agent: Agent = slug === "sherlock" ? "sherlock" : "jimmy";
        setMessages((prev) => {
          const next = [...prev];
          const placeholderId = pendingPlaceholderRef.current;
          const idx = placeholderId ? next.findIndex((m) => m.id === placeholderId) : -1;
          if (idx >= 0 && agent === "jimmy") {
            next[idx] = { id: row.id, agent, text };
            pendingPlaceholderRef.current = null;
          } else {
            next.push({ id: row.id, agent, text });
          }
          return next;
        });
      },
      onError: (err) => console.warn("[UnifiedChat] thread stream error:", err),
    });
    return unsub;
  }, [threadId]);

  const charCount = draft.length;
  const overLimit = charCount > MAX_CHARS;

  const submit = () => {
    const prompt = draft.trim();
    if (!prompt || overLimit) return;
    const placeholderId = `j-${Date.now() + 1}`;
    pendingPlaceholderRef.current = placeholderId;
    setMessages((prev) => [
      ...prev,
      { id: `f-${Date.now()}`, agent: "founder", text: prompt },
      { id: placeholderId, agent: "jimmy", text: "Working on it…", thinking: true },
    ]);
    setDraft("");

    // Phase A.1 — POST to axonetis-builder /api/agents/jimmy/chat.
    // Worker writes assistant row to Supabase 3 → Realtime fires → replaces placeholder.
    void chatWithAgent("jimmy", { projectId: project, threadId, prompt })
      .then((ack) => {
        if (!threadId && ack.threadId) setThreadId(ack.threadId);
        if (ack.assistantText) {
          const cleaned = cleanAgentText(ack.assistantText);
          setMessages((prev) => {
            const next = [...prev];
            const placeholderId = pendingPlaceholderRef.current;
            const idx = placeholderId ? next.findIndex((m) => m.id === placeholderId) : -1;
            if (idx >= 0) {
              next[idx] = { id: ack.assistantMessageId ?? placeholderId ?? `j-${Date.now()}`, agent: "jimmy", text: cleaned };
              pendingPlaceholderRef.current = null;
            }
            return next;
          });
        }
      })
      .catch((err) => {
        console.warn("[UnifiedChat] chatWithAgent failed:", err);
        // Mirror command into legacy bridge so bridge status panel still ticks.
        void sendBuilderCommand({ projectId: project, branch, environment, prompt }).catch(() => undefined);
      });
  };



  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#06060a] to-[#040406]">
      {/* HEADER — minimal, no clutter */}
      <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/40 px-5 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914]/40 to-transparent" />
        <div className="flex min-w-0 items-center gap-3">
          <Radio className="h-3.5 w-3.5 shrink-0 text-[#ff6b73]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/80">
            Build Chat
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider"
            style={{ borderColor: `${activeProject.accent}66`, background: `${activeProject.accent}1a`, color: "#fff" }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: activeProject.accent, boxShadow: `0 0 8px ${activeProject.accent}` }} />
            {activeProject.shortName} · {supabaseLabelFor(project)}
          </span>
          {fixIteration > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/15 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#c4a8ff]">
              <ShieldCheck className="h-2.5 w-2.5" /> Sherlock {fixIteration}/3
            </span>
          )}
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">
          {bridgeStatus}
        </span>
      </div>

      {/* STREAM — virtualized for unlimited history */}
      <div className="relative flex-1 min-h-0">
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          followOutput="smooth"
          initialTopMostItemIndex={messages.length - 1}
          className="fb-no-scrollbar"
          style={{ height: "100%" }}
          itemContent={(_i, msg) => (
            <div className="px-6 py-2.5">
              <MessageRow msg={msg} />
            </div>
          )}
        />
        {/* Scroll nav — bottom-LEFT so it never overlaps the splitter handle on the right */}
        <div className="absolute bottom-3 left-4 z-20 flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#07070b]/85 shadow-[0_0_22px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <button
            type="button"
            title="Scroll to first message"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => virtuosoRef.current?.scrollToIndex({ index: 0, behavior: "smooth", align: "start" })}
            className="grid h-8 w-8 place-items-center text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <div className="h-px bg-white/[0.08]" />
          <button
            type="button"
            title="Scroll to latest message"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: "smooth", align: "end" })}
            className="grid h-8 w-8 place-items-center text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* COMPOSER */}
      <div className="shrink-0 border-t border-white/[0.06] bg-background/40 p-4 backdrop-blur-xl">
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fb-glass flex items-end gap-2.5 rounded-2xl p-2.5 shadow-[0_8px_40px_-12px_rgba(229,9,20,0.25)]"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Tell Jimmy what to build, or ask Sherlock to debug…"
            rows={1}
            className="max-h-[320px] min-h-[44px] flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-[14px] outline-none placeholder:text-muted-foreground/70"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 320)}px`;
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || overLimit}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#E50914] to-[#7c0610] text-white shadow-[0_0_24px_rgba(229,9,20,0.55)] transition-opacity disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-widest text-muted-foreground/50">
          <span className="font-mono">⌘ ↵ send</span>
          <span className={`font-mono ${overLimit ? "text-red-400" : charCount > MAX_CHARS * 0.9 ? "text-amber-400" : "text-muted-foreground/50"}`}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: Msg }) {
  const m = AGENT_META[msg.agent];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="flex gap-4"
    >
      <div className={`mt-1 w-[3px] shrink-0 rounded-full ${m.rail}`} />
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-xs font-bold ${m.chip} ring-2 ${m.ring}`}>
        {m.initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline gap-2.5">
          <span className="text-[13px] font-semibold">{m.name}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{m.subtitle}</span>
        </div>
        {msg.thinking ? (
          <div className="text-[14px] fb-shimmer">{msg.text}</div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground/90">{msg.text}</div>
        )}
      </div>
    </motion.div>
  );
}

// MAX_ATTACHMENTS exported for future attachment uploader (Phase 6.1 wiring)
export { MAX_CHARS, MAX_ATTACHMENTS };
