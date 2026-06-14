import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Check, Octagon, Radio, Rocket, Send, X } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { sendBuilderCommand } from "@/lib/hostflow-api";

type Agent = "founder" | "jimmy" | "sherlock";
interface Msg { id: string; agent: Agent; text: string; thinking?: boolean }

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
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState("");
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Always-snap-to-bottom on new message (butter-smooth via virtuoso)
  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: "smooth", align: "end" });
  }, [messages.length]);

  const charCount = draft.length;
  const overLimit = charCount > MAX_CHARS;

  const submit = () => {
    const prompt = draft.trim();
    if (!prompt || overLimit) return;
    setMessages((prev) => [
      ...prev,
      { id: `f-${Date.now()}`, agent: "founder", text: prompt },
      { id: `j-${Date.now() + 1}`, agent: "jimmy", text: "Working on it…", thinking: true },
    ]);
    void sendBuilderCommand({ projectId: project, branch, environment, prompt }).catch(() => undefined);
    setDraft("");
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
              ∞ history · 5M chars
            </span>
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
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
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
            Phase 6 · bridge {bridgeStatus}
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
