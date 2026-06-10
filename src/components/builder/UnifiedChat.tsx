import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Octagon, Rocket, Send, X } from "lucide-react";

type Agent = "founder" | "jimmy" | "sherlock";
interface Msg { id: string; agent: Agent; text: string; thinking?: boolean }

const SEED: Msg[] = [
  { id: "1", agent: "founder", text: "Phase 1 shell ready ho gaya. Let's see the unified chat in action." },
  { id: "2", agent: "jimmy", text: "Roger that. Frontend orchestration online. Sherlock standing by for code review and auto-fix loops." },
  { id: "3", agent: "sherlock", text: "Diagnostics nominal. No errors in the bridge. Awaiting first build instruction." },
];

const AGENT_META: Record<Agent, { name: string; rail: string; chip: string; initial: string }> = {
  founder:  { name: "Founder",  rail: "bg-white",                            chip: "bg-white/[0.08] text-white",                  initial: "F" },
  jimmy:    { name: "Jimmy",    rail: "bg-[#E50914] shadow-[0_0_12px_#E50914]", chip: "bg-[#E50914]/15 text-[#ff6b73]",            initial: "J" },
  sherlock: { name: "Sherlock", rail: "bg-[#7c3aed] shadow-[0_0_12px_#7c3aed]", chip: "bg-[#7c3aed]/15 text-[#c4a8ff]",            initial: "S" },
};

export default function UnifiedChat() {
  const [messages] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState("");

  return (
    <div className="flex h-full flex-col">
      {/* Conversation header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/40 px-3">
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>Unified build chat</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> Founder
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E50914]" /> Jimmy
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed]" /> Sherlock
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ActionBtn icon={Octagon} label="Stop" />
          <ActionBtn icon={Check} label="Approve" tone="emerald" />
          <ActionBtn icon={X} label="Reject" tone="red" />
          <ActionBtn icon={Rocket} label="Deploy" tone="accent" />
        </div>
      </div>

      {/* Stream */}
      <div className="fb-no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => <MessageRow key={m.id} msg={m} />)}
          <MessageRow key="thinking" msg={{ id: "t", agent: "jimmy", text: "Jimmy is standing by…", thinking: true }} />
        </AnimatePresence>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-white/[0.06] bg-background/40 p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); setDraft(""); }}
          className="fb-glass flex items-end gap-2 rounded-xl p-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tell Jimmy what to build, or ask Sherlock to debug…"
            rows={1}
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.4)] transition-opacity disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <div className="mt-1.5 px-1 text-[10px] text-muted-foreground">
          Phase 1: visual only. Agents wire in Phase 2.
        </div>
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: Msg }) {
  const meta = AGENT_META[msg.agent];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="flex gap-3"
    >
      {/* color rail */}
      <div className={`mt-1 w-[3px] shrink-0 rounded-full ${meta.rail}`} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${meta.chip}`}>
            {meta.initial}
          </span>
          <span className="text-xs font-semibold">{meta.name}</span>
        </div>
        {msg.thinking ? (
          <div className="text-sm fb-shimmer">{msg.text}</div>
        ) : (
          <div className="text-sm leading-relaxed text-foreground/90">{msg.text}</div>
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
    <button className={`flex h-6 items-center gap-1 rounded-md border bg-white/[0.02] px-2 text-[10px] uppercase tracking-wider transition-colors ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
