import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Check, ChevronDown, ChevronUp, Octagon, Radio, Rocket, Send, X, ShieldCheck } from "lucide-react";
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
  const { project, branch, environment, bridgeStatus, lastBridgeEvent } = useBuilder();
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
          setMessages((prev) => {
            const next = [...prev];
            const placeholderId = pendingPlaceholderRef.current;
            const idx = placeholderId ? next.findIndex((m) => m.id === placeholderId) : -1;
            if (idx >= 0) {
              next[idx] = { id: ack.assistantMessageId ?? placeholderId ?? `j-${Date.now()}`, agent: "jimmy", text: ack.assistantText ?? "" };
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
      {/* HEADER */}
      <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/40 px-5 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914]/40 to-transparent" />
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-[#ff6b73]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/80">
              Unified Build Chat
            </span>
            <span className="ml-1 rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
              ∞ history · 5M chars · 10k files
            </span>
            {/* Phase 7 — active project + Supabase isolation chip */}
            <span
              className="ml-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider"
              style={{ borderColor: `${activeProject.accent}66`, background: `${activeProject.accent}1a`, color: "#fff" }}
              title="Phase 7 — independent workspace, history & preview per project"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: activeProject.accent, boxShadow: `0 0 8px ${activeProject.accent}` }} />
              {activeProject.shortName} · {supabaseLabelFor(project)}
            </span>
            {fixIteration > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/15 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#c4a8ff]">
                <ShieldCheck className="h-2.5 w-2.5" /> Sherlock fix {fixIteration}/3
              </span>
            )}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            {(["founder", "jimmy", "sherlock"] as Agent[]).map((a) => (
              <AgentPresence key={a} agent={a} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ActionBtn icon={Octagon} label="Stop" />
          <ActionBtn icon={Check} label="Approve" tone="emerald" />
          <ActionBtn icon={X} label="Reject" tone="red" />
          <ActionBtn icon={Rocket} label="Deploy" tone="accent" />
        </div>
      </div>

      {/* STREAM — virtualized for unlimited history */}
      <div className="flex-1 min-h-0">
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
      </div>

      {/* COMPOSER */}
      <div className="shrink-0 border-t border-white/[0.06] bg-background/40 p-4 backdrop-blur-xl">
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="fb-glass flex items-end gap-2.5 rounded-2xl p-2.5 shadow-[0_8px_40px_-12px_rgba(229,9,20,0.25)]"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => {
              // Enter = send, Shift+Enter (or Ctrl/Cmd+Enter) = newline
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Tell Jimmy what to build, or ask Sherlock to debug…"
            rows={1}
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] outline-none placeholder:text-muted-foreground/70"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
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
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">
          <span>
            Phase 7 · {activeProject.shortName} · bridge {bridgeStatus}
            {lastBridgeEvent ? ` · ${lastBridgeEvent.summary}` : ""}
          </span>
          <span className="flex items-center gap-3">
            <span className={`font-mono ${overLimit ? "text-red-400" : charCount > MAX_CHARS * 0.9 ? "text-amber-400" : "text-muted-foreground/60"}`}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
            <span className="font-mono">⌘ ↵ send</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function AgentPresence({ agent }: { agent: Agent }) {
  const m = AGENT_META[agent];
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
      <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold ${m.chip}`}>
        {m.initial}
      </span>
      <span className="text-[11px] font-medium text-foreground/85">{m.name}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{m.subtitle}</span>
      <span className={`ml-0.5 h-1.5 w-1.5 rounded-full ${m.rail}`} />
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

function ActionBtn({
  icon: Icon, label, tone,
}: { icon: typeof Check; label: string; tone?: "emerald" | "red" | "accent" }) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
      : tone === "red"
      ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
      : tone === "accent"
      ? "border-[#E50914]/40 text-[#ff6b73] hover:bg-[#E50914]/10"
      : "border-white/[0.08] text-muted-foreground hover:text-foreground";
  return (
    <button className={`flex h-7 items-center gap-1.5 rounded-md border bg-white/[0.02] px-2.5 text-[10px] uppercase tracking-wider transition-colors ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

// MAX_ATTACHMENTS exported for future attachment uploader (Phase 6.1 wiring)
export { MAX_CHARS, MAX_ATTACHMENTS };
