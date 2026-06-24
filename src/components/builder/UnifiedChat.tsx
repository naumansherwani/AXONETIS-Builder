import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Bot, ChevronDown, ChevronUp, Mic, Paperclip, Radio, ShieldCheck, Slash } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
type ChatStatus = "ready" | "submitted" | "streaming";
type UnifiedAgentSlug = Extract<AgentSlug, "jimmy" | "sherlock">;

// Phase 6 LOCKED limits
const MAX_CHARS = 5_000_000;
const MAX_ATTACHMENTS = 10_000;

const SEED: Msg[] = [
  { id: "1", agent: "founder", text: "Phase 1 shell ready ho gaya. Let's see the unified chat in action." },
  { id: "2", agent: "jimmy", text: "Roger that. Frontend orchestration online. Sherlock standing by for code review and auto-fix loops." },
  { id: "3", agent: "sherlock", text: "Diagnostics nominal. No errors in the bridge. Awaiting first build instruction." },
];

const AGENT_META: Record<Agent, { name: string; subtitle: string; rail: string; chip: string; ring: string; initial: string }> = {
  founder: { name: "Founder", subtitle: "Operator", rail: "bg-white shadow-[0_0_18px_rgba(255,255,255,0.6)]", chip: "bg-white/[0.08] text-white border-white/20", ring: "ring-white/30", initial: "F" },
  jimmy: { name: "Jimmy", subtitle: "Build Agent", rail: "bg-[#E50914] shadow-[0_0_18px_#E50914]", chip: "bg-[#E50914]/15 text-[#ff7480] border-[#E50914]/40", ring: "ring-[#E50914]/50", initial: "J" },
  sherlock: { name: "Sherlock", subtitle: "Review · Audit", rail: "bg-[#7c3aed] shadow-[0_0_18px_#7c3aed]", chip: "bg-[#7c3aed]/15 text-[#c4a8ff] border-[#7c3aed]/40", ring: "ring-[#7c3aed]/50", initial: "S" },
};

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
  const [selectedAgent, setSelectedAgent] = useState<UnifiedAgentSlug>("jimmy");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [queue, setQueue] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [composerNotice, setComposerNotice] = useState("");
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const pendingPlaceholderRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

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
  }, [project]);

  useEffect(() => {
    patchWorkspace(project, { messages, fixLoopIteration: fixIteration, jimmyThreadId: threadId });
  }, [project, messages, fixIteration, threadId]);

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: "smooth", align: "end" });
  }, [messages.length]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [project, status]);

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
        setMessages((prev) => {
          const next = [...prev];
          const placeholderId = pendingPlaceholderRef.current;
          const idx = placeholderId ? next.findIndex((m) => m.id === placeholderId) : -1;
          if (idx >= 0) {
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
  const busy = status === "submitted" || status === "streaming";

  const executePrompt = useCallback((prompt: string) => {
    const placeholderId = `j-${Date.now() + 1}`;
    const streamId = `stream-${Date.now()}`;
    const attachmentNote = attachments.length
      ? `\n\nAttached context:\n${attachments.map((file) => `- ${file.name}: ${file.url}`).join("\n")}`
      : "";

    pendingPlaceholderRef.current = placeholderId;
    streamIdRef.current = streamId;
    setStatus("streaming");
    setComposerNotice("");
    setMessages((prev) => [
      ...prev,
      { id: `f-${Date.now()}`, agent: "founder", text: prompt },
      { id: placeholderId, agent: selectedAgent, text: `${selectedAgent === "sherlock" ? "Auditing" : "Thinking"}…`, thinking: true },
    ]);
    setAttachments([]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    void chatWithAgent(selectedAgent, { projectId: project, threadId, prompt: `${prompt}${attachmentNote}`, streamId }, { signal: ctrl.signal })
      .then((ack) => {
        if (!threadId && ack.threadId) setThreadId(ack.threadId);
        if (ack.assistantText) {
          const cleaned = cleanAgentText(ack.assistantText);
          setMessages((prev) => {
            const next = [...prev];
            const currentPlaceholder = pendingPlaceholderRef.current;
            const idx = currentPlaceholder ? next.findIndex((m) => m.id === currentPlaceholder) : -1;
            if (idx >= 0) {
              next[idx] = { id: ack.assistantMessageId ?? currentPlaceholder ?? `j-${Date.now()}`, agent: selectedAgent, text: cleaned };
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
  }, [attachments, branch, environment, project, selectedAgent, threadId]);

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
      recorder.ondataavailable = (event) => {
        if (event.data.size) voiceChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };
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

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#06060a] to-[#040406]">
      <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/40 px-5 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914]/40 to-transparent" />
        <div className="flex min-w-0 items-center gap-3">
          <Radio className="h-3.5 w-3.5 shrink-0 text-[#ff6b73]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/80">Build Chat</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider"
            style={{ borderColor: `${activeProject.accent}66`, background: `${activeProject.accent}1a`, color: "#fff" }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: activeProject.accent, boxShadow: `0 0 8px ${activeProject.accent}` }} />
            {activeProject.shortName} · {supabaseLabelFor(project).replace("Supabase", "SB")}
          </span>
          {fixIteration > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/15 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#c4a8ff]">
              <ShieldCheck className="h-2.5 w-2.5" /> Sherlock {fixIteration}/3
            </span>
          )}
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">{bridgeStatus}</span>
      </div>

      <div className="relative min-h-0 flex-1">
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
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            title="Scroll to top"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => virtuosoRef.current?.scrollToIndex({ index: 0, behavior: "smooth", align: "start" })}
            className="pointer-events-auto grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-black/60 text-muted-foreground/80 backdrop-blur transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Scroll to latest"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: "smooth", align: "end" })}
            className="pointer-events-auto grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-black/60 text-muted-foreground/80 backdrop-blur transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-background/40 p-4 backdrop-blur-xl">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onAttach} />
        <PromptInput onSubmit={(e) => { e.preventDefault(); submit(); }} onPointerDown={(e) => e.stopPropagation()}>
          <PromptInputTextarea
            ref={textareaRef}
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
            placeholder={selectedAgent === "sherlock" ? "Ask Sherlock to audit, debug, or verify…" : "Tell Jimmy what to build…"}
            rows={1}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 260)}px`;
            }}
          />
          <PromptInputFooter>
            <TooltipProvider delayDuration={150}>
              <div className="flex min-w-0 items-center gap-1.5">
                <Select value={selectedAgent} onValueChange={(value) => setSelectedAgent(value as UnifiedAgentSlug)}>
                  <SelectTrigger className="h-8 w-[120px] rounded-lg border-white/[0.08] bg-white/[0.02] px-2 text-[11px]">
                    <Bot className="mr-1.5 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jimmy">Jimmy</SelectItem>
                    <SelectItem value="sherlock">Sherlock</SelectItem>
                  </SelectContent>
                </Select>
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
                <div className="hidden items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:flex">
                  <Slash className="h-3 w-3" /> /fix /scan /deploy /rollback
                </div>
              </div>
            </TooltipProvider>
            <div className="flex items-center gap-2">
              {queue.length > 0 && (
                <span className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Queue {queue.length}</span>
              )}
              <PromptInputSubmit status={status} disabled={!draft.trim() || overLimit} onStop={stop} />
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
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-widest text-muted-foreground/50">
          <span className="font-mono">Phase 3.9.1 audit · {busy ? "agent running" : "ready"}</span>
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
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-xs font-bold ${m.chip} ring-2 ${m.ring}`}>{m.initial}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline gap-2.5">
          <span className="text-[13px] font-semibold">{m.name}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{m.subtitle}</span>
        </div>
        {msg.thinking ? <Shimmer className="text-[14px]" duration={2}>{msg.text}</Shimmer> : <MessageResponse>{msg.text}</MessageResponse>}
      </div>
    </motion.div>
  );
}

export { MAX_CHARS, MAX_ATTACHMENTS };
