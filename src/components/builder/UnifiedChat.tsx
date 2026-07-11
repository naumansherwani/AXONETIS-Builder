import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Mic, Paperclip, Radio, RefreshCw, Send, ShieldCheck, Zap } from "lucide-react";
import ChatScrollRail from "./ChatScrollRail";
import { MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBuilder } from "@/lib/builder-state";
import {
  cancelAgentStream,
  chatWithAgent,
  sendBuilderCommand,
  transcribeVoice,
  uploadAttachment,
  type AgentSlug,
  type UploadedAttachment,
} from "@/lib/hostflow-api";
import { PROJECTS } from "@/lib/projects";
import { loadWorkspace, patchWorkspace, type ChatMsg } from "@/lib/project-workspace";
import {
  subscribeThread,
  fetchThreadMessages,
  extractText,
  cleanAgentText,
  UNIFIED_CHAT_SLUGS,
} from "@/lib/agent-stream";

type Agent = "founder" | "jimmy" | "sherlock";
type Msg = ChatMsg;
type ChatStatus = "ready" | "submitted" | "streaming";
type UnifiedAgentSlug = Extract<AgentSlug, "jimmy" | "sherlock">;

const MAX_CHARS = 5_000_000;
const MAX_ATTACHMENTS = 10_000;
const SCROLL_STEP = 260;
const BOTTOM_THRESHOLD = 24;

const SEED: Msg[] = [];

/** 3.9.1 slash commands — quick actions parsed from draft. */
const SLASH_COMMANDS: Array<{ cmd: string; label: string; hint: string; agent: UnifiedAgentSlug }> = [
  { cmd: "/scan",     label: "/scan",     hint: "Sherlock full audit",         agent: "sherlock" },
  { cmd: "/fix",      label: "/fix",      hint: "Auto-fix last error",         agent: "sherlock" },
  { cmd: "/review",   label: "/review",   hint: "Review current diff",         agent: "sherlock" },
  { cmd: "/rollback", label: "/rollback", hint: "Roll back last change",       agent: "jimmy"    },
  { cmd: "/versions", label: "/versions", hint: "Show version history",        agent: "jimmy"    },
  { cmd: "/publish",  label: "/publish",  hint: "Promote sandbox → prod",      agent: "jimmy"    },
  { cmd: "/help",     label: "/help",     hint: "Show commands",               agent: "jimmy"    },
];

const MENTIONS: Array<{ tag: string; agent: UnifiedAgentSlug; hint: string }> = [
  { tag: "@jimmy",    agent: "jimmy",    hint: "Build agent"  },
  { tag: "@sherlock", agent: "sherlock", hint: "Review agent" },
];

const resolveAgent = (prompt: string): UnifiedAgentSlug => {
  const p = prompt.toLowerCase();
  if (p.includes("@sherlock")) return "sherlock";
  if (p.includes("@jimmy")) return "jimmy";
  return p.includes("sherlock") || p.includes("/scan") || p.includes("/fix") || p.includes("/review") ? "sherlock" : "jimmy";
};

const AGENT_META: Record<Agent, { name: string; subtitle: string; rail: string; chip: string; ring: string; initial: string }> = {
  founder: { name: "Founder", subtitle: "Operator", rail: "bg-white shadow-[0_0_18px_rgba(255,255,255,0.6)]", chip: "bg-white/[0.08] text-white border-white/20", ring: "ring-white/30", initial: "F" },
  jimmy: { name: "Jimmy", subtitle: "Build Agent", rail: "bg-[#E50914] shadow-[0_0_18px_#E50914]", chip: "bg-[#E50914]/15 text-[#ff7480] border-[#E50914]/40", ring: "ring-[#E50914]/50", initial: "J" },
  sherlock: { name: "Sherlock", subtitle: "Review · Audit", rail: "bg-[#7c3aed] shadow-[0_0_18px_#7c3aed]", chip: "bg-[#7c3aed]/15 text-[#c4a8ff] border-[#7c3aed]/40", ring: "ring-[#7c3aed]/50", initial: "S" },
};

function relTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = (Date.now() - t) / 1000;
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function UnifiedChat() {
  const { project, branch, environment, bridgeStatus } = useBuilder();
  const activeProject = PROJECTS.find((p) => p.id === project)!;

  const [messages, setMessages] = useState<Msg[]>(() => {
    const ws = loadWorkspace(project, SEED);
    return ws.messages.length ? ws.messages : SEED;
  });
  const [fixIteration, setFixIteration] = useState<number>(() => loadWorkspace(project, SEED).fixLoopIteration);
  const [threadId, setThreadId] = useState<string | undefined>(() => loadWorkspace(project, SEED).jimmyThreadId);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [queue, setQueue] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [composerNotice, setComposerNotice] = useState("");
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  const messagesRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const pendingPlaceholderRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // --- Scroll helpers ---
  const updateScrollEdges = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const top = el.scrollTop <= 1;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
    setAtTop(top);
    setAtBottom(bottom);
    stickToBottomRef.current = bottom;
  }, []);

  const scrollByDelta = useCallback((delta: number) => {
    messagesRef.current?.scrollBy({ top: delta, behavior: "smooth" });
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const scrollToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesRef.current?.scrollTo({ top: 0, behavior });
  }, []);

  // Project switch — reset state
  useEffect(() => {
    const ws = loadWorkspace(project, SEED);
    setMessages(ws.messages.length ? ws.messages : SEED);
    setFixIteration(ws.fixLoopIteration);
    setThreadId(ws.jimmyThreadId);
    setDraft("");
    setQueue([]);
    setAttachments([]);
    setComposerNotice("");
    abortRef.current?.abort();
    abortRef.current = null;
    streamIdRef.current = null;
    setStatus("ready");
    seenMessageIdsRef.current = new Set();
    stickToBottomRef.current = true;
  }, [project]);

  // Persist workspace
  useEffect(() => {
    patchWorkspace(project, { messages, fixLoopIteration: fixIteration, jimmyThreadId: threadId });
  }, [project, messages, fixIteration, threadId]);

  // Auto-scroll only if user was at bottom
  useLayoutEffect(() => {
    if (stickToBottomRef.current) scrollToBottom("auto");
    updateScrollEdges();
  }, [messages, scrollToBottom, updateScrollEdges]);

  // Focus textarea on project switch / after submit
  useEffect(() => {
    textareaRef.current?.focus();
  }, [project, status]);

  // Realtime thread subscription
  useEffect(() => {
    if (!threadId) return;
    void fetchThreadMessages(threadId).then((rows) => {
      rows.forEach((r) => seenMessageIdsRef.current.add(r.id));
    });
    const unsub = subscribeThread(threadId, {
      onMessage: (row) => {
        if (seenMessageIdsRef.current.has(row.id)) return;
        seenMessageIdsRef.current.add(row.id);
        if (row.role !== "agent") return;
        const slug = (row.agent_slug ?? "jimmy") as AgentSlug;
        if (!UNIFIED_CHAT_SLUGS.has(slug)) return;
        const text = extractText(row) || "(empty reply)";
        const agent: Agent = slug === "sherlock" ? "sherlock" : "jimmy";
        const meta = {
          model: row.model ?? null,
          tokensIn: row.tokens_in ?? 0,
          tokensOut: row.tokens_out ?? 0,
          createdAt: row.created_at,
        };
        setMessages((prev) => {
          const next = [...prev];
          const placeholderId = pendingPlaceholderRef.current;
          const idx = placeholderId ? next.findIndex((m) => m.id === placeholderId) : -1;
          if (idx >= 0) {
            next[idx] = { ...next[idx], id: row.id, agent, text, thinking: false, meta };
            pendingPlaceholderRef.current = null;
          } else {
            next.push({ id: row.id, agent, text, meta });
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
  const busy = status === "submitted" || status === "streaming";

  const executePrompt = useCallback((prompt: string) => {
    const targetAgent = resolveAgent(prompt);
    const placeholderId = `j-${Date.now() + 1}`;
    const streamId = `stream-${Date.now()}`;
    const attachmentNote = attachments.length
      ? `\n\nAttached context:\n${attachments.map((file) => `- ${file.name}: ${file.url}`).join("\n")}`
      : "";

    pendingPlaceholderRef.current = placeholderId;
    streamIdRef.current = streamId;
    setStatus("streaming");
    setComposerNotice("");
    stickToBottomRef.current = true;
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: `f-${Date.now()}`, agent: "founder", text: prompt, meta: { createdAt: now } },
      { id: placeholderId, agent: targetAgent, text: `${targetAgent === "sherlock" ? "Auditing" : "Working"}…`, thinking: true, sourcePrompt: prompt, meta: { createdAt: now } },
    ]);
    setAttachments([]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    void chatWithAgent(targetAgent, { projectId: project, threadId, prompt: `${prompt}${attachmentNote}`, streamId }, { signal: ctrl.signal })
      .then((ack) => {
        if (!threadId && ack.threadId) setThreadId(ack.threadId);
        if (ack.assistantText) {
          const cleaned = cleanAgentText(ack.assistantText);
          setMessages((prev) => {
            const next = [...prev];
            const currentPlaceholder = pendingPlaceholderRef.current;
            const idx = currentPlaceholder ? next.findIndex((m) => m.id === currentPlaceholder) : -1;
            if (idx >= 0) {
              next[idx] = { ...next[idx], id: ack.assistantMessageId ?? currentPlaceholder ?? `j-${Date.now()}`, agent: targetAgent, text: cleaned, thinking: false };
              pendingPlaceholderRef.current = null;
            }
            return next;
          });
        }
      })
      .catch((err) => {
        if (ctrl.signal.aborted) {
          setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, text: "Stopped by founder.", thinking: false } : m)));
          return;
        }
        console.warn("[UnifiedChat] chatWithAgent failed:", err);
        setMessages((prev) => prev.map((m) => (
          m.id === placeholderId
            ? { ...m, agent: "sherlock", text: `Endpoint audit: ${err instanceof Error ? err.message : String(err)}`, thinking: false }
            : m
        )));
        void sendBuilderCommand({ projectId: project, branch, environment, prompt }).catch(() => undefined);
      })
      .finally(() => {
        abortRef.current = null;
        streamIdRef.current = null;
        setStatus("ready");
        textareaRef.current?.focus();
      });
  }, [attachments, branch, environment, project, threadId]);

  const submit = useCallback(() => {
    const prompt = draft.trim();
    if (!prompt || overLimit) return;
    setDraft("");
    if (busy) {
      setQueue((prev) => [...prev, prompt]);
      setComposerNotice("Prompt queued — current response pehle complete hogi.");
      return;
    }
    setStatus("submitted");
    executePrompt(prompt);
  }, [busy, draft, executePrompt, overLimit]);

  useEffect(() => {
    if (busy || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setStatus("submitted");
    executePrompt(next);
  }, [busy, executePrompt, queue]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    const streamId = streamIdRef.current;
    if (streamId) void cancelAgentStream(streamId).catch(() => undefined);
    pendingPlaceholderRef.current = null;
    setStatus("ready");
    setComposerNotice("Response stopped.");
    textareaRef.current?.focus();
  }, []);

  // 3.9.1 — retry an assistant message by re-running its sourcePrompt.
  const retry = useCallback((sourcePrompt: string) => {
    if (busy || !sourcePrompt) return;
    setStatus("submitted");
    executePrompt(sourcePrompt);
  }, [busy, executePrompt]);

  // 3.9.1 — session token meter (sum of assistant tokens_out on this thread).
  const sessionTokens = useMemo(() => {
    let inTok = 0, outTok = 0;
    for (const m of messages) {
      if (m.meta?.tokensIn) inTok += m.meta.tokensIn;
      if (m.meta?.tokensOut) outTok += m.meta.tokensOut;
    }
    return { inTok, outTok, total: inTok + outTok };
  }, [messages]);

  // 3.9.1 — slash + mention popover state derived from draft.
  const slashSuggestions = useMemo(() => {
    const t = draft.trimStart();
    if (!t.startsWith("/")) return [];
    const q = t.split(/\s/)[0].toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(q));
  }, [draft]);

  const mentionSuggestions = useMemo(() => {
    const match = draft.match(/(^|\s)@(\w*)$/);
    if (!match) return [];
    const q = `@${match[2].toLowerCase()}`;
    return MENTIONS.filter((m) => m.tag.startsWith(q));
  }, [draft]);

  const applySlash = useCallback((cmd: string) => {
    const rest = draft.trimStart().replace(/^\S+/, "").trim();
    setDraft(rest ? `${cmd} ${rest}` : `${cmd} `);
    textareaRef.current?.focus();
  }, [draft]);

  const applyMention = useCallback((tag: string) => {
    setDraft((prev) => prev.replace(/(^|\s)@(\w*)$/, (_, lead) => `${lead}${tag} `));
    textareaRef.current?.focus();
  }, []);


  const onAttach = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setComposerNotice("Uploading attachment…");
    try {
      const uploaded = await Promise.all(files.map((file) => uploadAttachment(project, file)));
      setAttachments((prev) => [...prev, ...uploaded].slice(0, MAX_ATTACHMENTS));
      setComposerNotice(`${uploaded.length} attachment ready.`);
    } catch (err) {
      setComposerNotice(err instanceof Error ? err.message : "Upload endpoint pending.");
    } finally {
      textareaRef.current?.focus();
    }
  }, [project]);

  const startVoice = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setComposerNotice("Voice recording browser support nahi mila.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) voiceChunksRef.current.push(event.data); };
      recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); };
      recorder.start();
      setComposerNotice("Recording… release mic to transcribe.");
    } catch (err) {
      setComposerNotice(err instanceof Error ? err.message : "Mic permission failed.");
    }
  }, []);

  const stopVoice = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.onstop = async () => {
      const audio = new Blob(voiceChunksRef.current, { type: "audio/webm" });
      recorder.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      setComposerNotice("Transcribing voice…");
      try {
        const text = await transcribeVoice(project, audio);
        if (text) setDraft((prev) => `${prev}${prev ? " " : ""}${text}`);
        setComposerNotice(text ? "Voice inserted." : "Voice transcript empty.");
      } catch (err) {
        setComposerNotice(err instanceof Error ? err.message : "Voice endpoint pending.");
      } finally {
        textareaRef.current?.focus();
      }
    };
    recorder.stop();
  }, [project]);

  // Keyboard navigation on message list (and Ctrl/Cmd+Arrow from anywhere inside chat)
  const onListKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = messagesRef.current;
    if (!el) return;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); scrollByDelta(SCROLL_STEP / 3); break;
      case "ArrowUp": e.preventDefault(); scrollByDelta(-SCROLL_STEP / 3); break;
      case "PageDown": e.preventDefault(); scrollByDelta(el.clientHeight * 0.85); break;
      case "PageUp": e.preventDefault(); scrollByDelta(-el.clientHeight * 0.85); break;
      case "End": e.preventDefault(); scrollToBottom(); break;
      case "Home": e.preventDefault(); scrollToTop(); break;
    }
  }, [scrollByDelta, scrollToBottom, scrollToTop]);

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex h-full min-h-0 flex-col bg-background">

      {/* Header */}
      <div className="relative grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914]/40 to-transparent" />
        <div className="flex min-w-0 items-center gap-3">
          <Radio className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/85">Build Chat</span>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider"
            style={{ borderColor: `${activeProject.accent}66`, background: `${activeProject.accent}1a`, color: "#fff" }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: activeProject.accent, boxShadow: `0 0 8px ${activeProject.accent}` }} />
            {activeProject.shortName}
          </span>
          {fixIteration > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/15 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#c4a8ff]">
              <ShieldCheck className="h-2.5 w-2.5" /> Sherlock {fixIteration}/3
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {sessionTokens.total > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/80">
                  <Zap className="h-2.5 w-2.5 text-amber-400" />
                  {sessionTokens.total.toLocaleString()} tok
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-[10px] font-mono">
                  in: {sessionTokens.inTok.toLocaleString()} · out: {sessionTokens.outTok.toLocaleString()}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">{bridgeStatus}</span>
        </div>
      </div>

      {/* Messages — native scroll, keyboard accessible */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={messagesRef}
          tabIndex={0}
          onScroll={updateScrollEdges}
          onKeyDown={onListKeyDown}
          className="fb-no-scrollbar h-full overflow-y-auto outline-none focus-visible:ring-0"
        >
          <div className="flex flex-col gap-0 py-2">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-2 text-[13px] font-semibold text-foreground/90">No messages yet</div>
                <div className="max-w-[280px] text-[11px] leading-relaxed text-muted-foreground">
                  Tell Jimmy what to build. Sherlock will review and auto-fix on every change.
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="px-4 py-2.5">
                  <MessageRow msg={msg} onRetry={retry} />
                </div>
              ))
            )}
          </div>

        </div>

        {/* Slim arrow rail */}
        <div className="pointer-events-none absolute bottom-3 left-2 z-20 flex flex-col overflow-hidden rounded-full border border-border bg-background/80 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button
            type="button"
            title="Scroll up (↑/PgUp)"
            disabled={atTop}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => scrollByDelta(-SCROLL_STEP)}
            className="pointer-events-auto grid h-6 w-6 place-items-center text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <span className="mx-1 h-px bg-border" />
          <button
            type="button"
            title="Scroll down (↓/PgDn/End)"
            disabled={atBottom}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => scrollByDelta(SCROLL_STEP)}
            className="pointer-events-auto grid h-6 w-6 place-items-center text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Composer — pinned bottom */}
      <div className="relative shrink-0 border-t border-border bg-background/75 p-3 backdrop-blur-xl">
        {/* 3.9.1 — slash + @mention popovers */}
        <AnimatePresence>
          {(slashSuggestions.length > 0 || mentionSuggestions.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-white/[0.08] bg-background/95 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            >
              {slashSuggestions.map((c) => (
                <button
                  key={c.cmd}
                  type="button"
                  onClick={() => applySlash(c.cmd)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/40"
                >
                  <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${AGENT_META[c.agent].chip} ring-1 ${AGENT_META[c.agent].ring}`}>{AGENT_META[c.agent].initial}</span>
                  <span className="font-mono text-[11px] font-semibold text-foreground">{c.label}</span>
                  <span className="truncate text-[10px] text-muted-foreground">{c.hint}</span>
                </button>
              ))}
              {mentionSuggestions.map((mn) => (
                <button
                  key={mn.tag}
                  type="button"
                  onClick={() => applyMention(mn.tag)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/40"
                >
                  <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${AGENT_META[mn.agent].chip} ring-1 ${AGENT_META[mn.agent].ring}`}>{AGENT_META[mn.agent].initial}</span>
                  <span className="font-mono text-[11px] font-semibold text-foreground">{mn.tag}</span>
                  <span className="truncate text-[10px] text-muted-foreground">{mn.hint}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onAttach} />
        <PromptInput
          className="rounded-lg"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Escape") { (e.currentTarget as HTMLTextAreaElement).blur(); return; }
              if ((e.ctrlKey || e.metaKey) && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "PageUp" || e.key === "PageDown" || e.key === "Home" || e.key === "End")) {
                const el = messagesRef.current;
                if (!el) return;
                e.preventDefault();
                if (e.key === "ArrowUp") scrollByDelta(-SCROLL_STEP / 3);
                else if (e.key === "ArrowDown") scrollByDelta(SCROLL_STEP / 3);
                else if (e.key === "PageUp") scrollByDelta(-el.clientHeight * 0.85);
                else if (e.key === "PageDown") scrollByDelta(el.clientHeight * 0.85);
                else if (e.key === "Home") scrollToTop();
                else if (e.key === "End") scrollToBottom();
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Tell Jimmy what to build…"
            rows={1}
            className="fb-no-scrollbar pr-2"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 220)}px`;
            }}
          />
          <PromptInputFooter>
            <TooltipProvider delayDuration={150}>
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-accent/30 px-2.5 text-[11px] font-semibold text-foreground">
                  <span className="grid h-4 w-4 place-items-center rounded bg-primary text-[9px] text-primary-foreground">J</span>
                  Jimmy
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach files</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onPointerDown={(e) => { e.preventDefault(); void startVoice(); }}
                      onPointerUp={stopVoice}
                      onPointerLeave={stopVoice}
                    >
                      <Mic className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Hold to talk</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <div className="flex items-center gap-2">
              {queue.length > 0 && (
                <span className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Queue {queue.length}</span>
              )}
              <PromptInputSubmit status={status} disabled={!draft.trim() || overLimit} onStop={stop}>
                {status === "ready" ? <Send className="h-3.5 w-3.5" /> : undefined}
              </PromptInputSubmit>
            </div>
          </PromptInputFooter>
        </PromptInput>
        {(composerNotice || attachments.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-[10px] text-muted-foreground/70">
            {composerNotice && <span className="font-mono uppercase tracking-wider">{composerNotice}</span>}
            {attachments.map((file) => (
              <span key={`${file.url}-${file.name}`} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1">{file.name}</span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-widest text-muted-foreground/45">
          <span className="font-mono">Phase 3.9 · {busy ? "working" : "ready"}</span>
          <span className={`font-mono ${overLimit ? "text-red-400" : charCount > MAX_CHARS * 0.9 ? "text-amber-400" : "text-muted-foreground/50"}`}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

function MessageRow({ msg, onRetry }: { msg: Msg; onRetry: (sourcePrompt: string) => void }) {
  const m = AGENT_META[msg.agent];
  const [copied, setCopied] = useState(false);
  const isAssistant = msg.agent !== "founder";
  const canRetry = isAssistant && !!msg.sourcePrompt && !msg.thinking;
  const modelShort = msg.meta?.model
    ? msg.meta.model.split("/").slice(-1)[0].replace(/-instruct$|:free$/gi, "")
    : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* ignore */ }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="group relative grid grid-cols-[2px_30px_minmax(0,1fr)] gap-3"
    >
      <div className={`mt-1 w-[2px] shrink-0 rounded-full ${m.rail}`} />
      <div className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border text-[11px] font-bold ${m.chip} ring-1 ${m.ring}`}>{m.initial}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex min-w-0 items-center gap-2">
          <span className="text-[13px] font-semibold">{m.name}</span>
          <span className="truncate text-[10px] uppercase tracking-widest text-muted-foreground/55">{m.subtitle}</span>
          {msg.meta?.createdAt && (
            <span className="ml-auto shrink-0 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
              {relTime(msg.meta.createdAt)}
            </span>
          )}
        </div>
        {msg.thinking ? <Shimmer className="text-[14px]" duration={2}>{msg.text}</Shimmer> : <MessageResponse>{msg.text}</MessageResponse>}

        {/* meta chips + hover actions */}
        {isAssistant && !msg.thinking && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {modelShort && (
              <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
                {modelShort}
              </span>
            )}
            {msg.meta?.tokensOut ? (
              <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">
                {msg.meta.tokensOut.toLocaleString()} out
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={copy} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground">
                    <Copy className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
              </Tooltip>
              {canRetry && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => onRetry(msg.sourcePrompt!)} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground">
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Retry</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export { MAX_CHARS, MAX_ATTACHMENTS };
