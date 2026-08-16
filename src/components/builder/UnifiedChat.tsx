import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Copy,
  DollarSign,
  Mic,
  MousePointerClick,
  Paperclip,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  X as XIcon,
  Zap,
} from "lucide-react";
import ChatScrollRail from "./ChatScrollRail";
import VoiceWaveform from "./VoiceWaveform";
import ToolCallBubble from "./ToolCallBubble";
import DiffPreview from "./DiffPreview";
import PlanningTree from "./PlanningTree";
import DelegationTree from "@/components/builder/DelegationTree";
import SelfVerifyLoop from "./SelfVerifyLoop";
import { DiffBatchReview } from "./DiffApprovalModal";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBuilder } from "@/lib/builder-state";
import {
  cancelAgentStream,
  sendBuilderCommand,
  streamChatWithAgent,
  transcribeVoice,
  uploadAttachment,
  type AgentSlug,
  type UploadedAttachment,
} from "@/lib/hostflow-api";
import { PROJECTS } from "@/lib/projects";
import {
  loadWorkspace,
  patchWorkspace,
  type ActivityKind,
  type ActivityStep,
  type ChatMsg,
} from "@/lib/project-workspace";
import {
  subscribeThread,
  fetchThreadMessages,
  extractText,
  extractStructured,
  cleanAgentText,
  UNIFIED_CHAT_SLUGS,
  type AgentMessageRow,
} from "@/lib/agent-stream";
import { previewRoute, shortModelTag, formatUsd, type RouterPreview } from "@/lib/router-api";
import { abortToolCall } from "@/lib/tools-api";
import { ADVISORS, findAdvisor, detectMentionedAdvisor, routeToAdvisor } from "@/lib/advisors-api";
import { AdvisorBadge } from "./AdvisorMentionPicker";
import ThinkingLog from "./ThinkingLog";
import { recordExplanation } from "@/lib/explain-api";

type Msg = ChatMsg;
type Agent = Msg["agent"];
type ChatStatus = "ready" | "submitted" | "streaming";
type UnifiedAgentSlug = Exclude<AgentSlug, "router">;

const MAX_CHARS = 5_000_000;
const MAX_ATTACHMENTS = 10_000;
const SCROLL_STEP = 260;
const BOTTOM_THRESHOLD = 24;

const SEED: Msg[] = [];

/** 3.9.1 slash commands — quick actions parsed from draft. */
const SLASH_COMMANDS: Array<{ cmd: string; label: string; hint: string; agent: UnifiedAgentSlug }> =
  [
    { cmd: "/scan", label: "/scan", hint: "Sherlock full audit", agent: "sherlock" },
    { cmd: "/fix", label: "/fix", hint: "Auto-fix last error", agent: "sherlock" },
    { cmd: "/explain", label: "/explain", hint: "Explain code / last error", agent: "sherlock" },
    { cmd: "/review", label: "/review", hint: "Review current diff", agent: "sherlock" },
    { cmd: "/rollback", label: "/rollback", hint: "Roll back last change", agent: "jimmy" },
    { cmd: "/versions", label: "/versions", hint: "Show version history", agent: "jimmy" },
    { cmd: "/deploy", label: "/deploy", hint: "Ship sandbox → production", agent: "jimmy" },
    { cmd: "/publish", label: "/publish", hint: "Promote sandbox → prod", agent: "jimmy" },
    { cmd: "/help", label: "/help", hint: "Show commands", agent: "jimmy" },
  ];

const MENTIONS: Array<{ tag: string; agent: UnifiedAgentSlug; hint: string }> = [
  { tag: "@jimmy", agent: "jimmy", hint: "Build agent" },
  { tag: "@sherlock", agent: "sherlock", hint: "Review agent" },
  ...ADVISORS.map((advisor) => ({
    tag: `@${advisor.slug}`,
    agent: advisor.slug as UnifiedAgentSlug,
    hint: `${advisor.domain} · ${advisor.tagline}`,
  })),
];

/**
 * 3.9.6 — Voice-deploy intent detection.
 * If the founder speaks "deploy karo" / "rollback karo" / "scan karo" etc.,
 * we auto-fire the matching slash-command instead of just inserting text.
 * Supports Roman-Urdu + English keywords.
 */
function detectVoiceIntent(text: string): { slash: string; prompt: string } | null {
  const t = text.toLowerCase();
  if (/\b(deploy|publish|ship|live\s*karo|deploy\s*karo|publish\s*karo)\b/.test(t))
    return { slash: "/deploy", prompt: `/deploy (voice) — ${text}` };
  if (/\b(rollback|revert|undo|wapas|rollback\s*karo)\b/.test(t))
    return { slash: "/rollback", prompt: `/rollback (voice) — ${text}` };
  if (/\b(scan|audit|sherlock\s*scan|scan\s*karo|audit\s*karo)\b/.test(t))
    return { slash: "/scan", prompt: `/scan (voice) — ${text}` };
  if (/\b(fix|fix\s*karo|repair)\b/.test(t))
    return { slash: "/fix", prompt: `/fix (voice) — ${text}` };
  if (/\b(explain|samjhao|samjha\s*do|bata\s*do)\b/.test(t))
    return { slash: "/explain", prompt: `/explain (voice) — ${text}` };
  if (/\b(review|review\s*karo|check\s*diff)\b/.test(t))
    return { slash: "/review", prompt: `/review (voice) — ${text}` };
  return null;
}

const resolveAgent = (prompt: string, selected: UnifiedAgentSlug): UnifiedAgentSlug => {
  const p = prompt.toLowerCase();
  if (p.includes("@sherlock")) return "sherlock";
  if (p.includes("@jimmy")) return "jimmy";
  const advisor = detectMentionedAdvisor(prompt);
  if (advisor) return advisor.slug as UnifiedAgentSlug;
  // Jimmy is the default conversational/build agent. A founder message can
  // mention Sherlock while explaining company context; that must not silently
  // hand the whole turn to the audit agent. Sherlock runs only when explicitly
  // addressed or invoked through one of his commands.
  return /^\s*(?:(?:hi|hello|salam)\s+)?sherlock\b/i.test(prompt) ||
    /^\s*\/(?:scan|fix|explain|review)\b/i.test(prompt)
    ? "sherlock"
    : selected;
};

const AGENT_META: Record<
  Agent,
  { name: string; subtitle: string; rail: string; chip: string; ring: string; initial: string }
> = {
  founder: {
    name: "Founder",
    subtitle: "Operator",
    rail: "bg-white shadow-[0_0_18px_rgba(255,255,255,0.6)]",
    chip: "bg-white/[0.08] text-white border-white/20",
    ring: "ring-white/30",
    initial: "F",
  },
  jimmy: {
    name: "Jimmy",
    subtitle: "Build Agent",
    rail: "bg-[#E50914] shadow-[0_0_18px_#E50914]",
    chip: "bg-[#E50914]/15 text-[#ff7480] border-[#E50914]/40",
    ring: "ring-[#E50914]/50",
    initial: "J",
  },
  sherlock: {
    name: "Sherlock",
    subtitle: "Review · Audit",
    rail: "bg-[#7c3aed] shadow-[0_0_18px_#7c3aed]",
    chip: "bg-[#7c3aed]/15 text-[#c4a8ff] border-[#7c3aed]/40",
    ring: "ring-[#7c3aed]/50",
    initial: "S",
  },
  ...Object.fromEntries(
    ADVISORS.map((advisor) => [
      advisor.slug,
      {
        name: advisor.name,
        subtitle: `${advisor.domain} AI`,
        rail: "bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.65)]",
        chip: "bg-cyan-400/10 text-cyan-200 border-cyan-400/35",
        ring: "ring-cyan-400/40",
        initial: advisor.glyph,
      },
    ]),
  ),
} as Record<
  Agent,
  { name: string; subtitle: string; rail: string; chip: string; ring: string; initial: string }
>;

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
  const { project, branch, environment, bridgeStatus, lastVisualEditPick, setLastVisualEditPick } =
    useBuilder();
  const activeProject = PROJECTS.find((p) => p.id === project) ?? PROJECTS[0];

  const [messages, setMessages] = useState<Msg[]>(() => {
    const ws = loadWorkspace(project, SEED);
    return ws.messages.length ? ws.messages : SEED;
  });
  const [fixIteration, setFixIteration] = useState<number>(
    () => loadWorkspace(project, SEED).fixLoopIteration,
  );
  const [threadId, setThreadId] = useState<string | undefined>(
    () => loadWorkspace(project, SEED).jimmyThreadId,
  );
  const [draft, setDraft] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<UnifiedAgentSlug>("jimmy");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [queue, setQueue] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [composerNotice, setComposerNotice] = useState("");
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const voiceStartYRef = useRef<number | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const pendingPlaceholderRef = useRef<string | null>(null);
  const pendingUserMessageIdRef = useRef<string | null>(null);
  const ignoredParentMessageIdsRef = useRef<Set<string>>(new Set());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);

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

  // PHASE 12.3 — Help Center "Contact support" prefills the composer with Jimmy.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (!text) return;
      setDraft(text);
      textareaRef.current?.focus();
    };
    window.addEventListener("axonetis:jimmy-ask", onAsk as EventListener);
    return () => window.removeEventListener("axonetis:jimmy-ask", onAsk as EventListener);
  }, []);

  const ingestAgentRow = useCallback((row: AgentMessageRow) => {
    if (seenMessageIdsRef.current.has(row.id)) return;
    seenMessageIdsRef.current.add(row.id);
    if (row.role !== "agent") return;
    if (row.parent_message_id && ignoredParentMessageIdsRef.current.has(row.parent_message_id))
      return;
    if (
      pendingUserMessageIdRef.current &&
      row.parent_message_id &&
      row.parent_message_id !== pendingUserMessageIdRef.current
    )
      return;
    const slug = (row.agent_slug ?? "jimmy") as AgentSlug;
    if (!UNIFIED_CHAT_SLUGS.has(slug)) return;
    const text = extractText(row);
    if (!text) return;
    const { toolCalls, diffs, plans, verifications, delegations } = extractStructured(row);
    const agent = slug as UnifiedAgentSlug;
    const meta = {
      model: row.model ?? null,
      tokensIn: row.tokens_in ?? 0,
      tokensOut: row.tokens_out ?? 0,
      createdAt: row.created_at,
      costUsd: typeof row.cost_usd === "number" ? row.cost_usd : undefined,
      savedVsDefaultUsd:
        typeof row.saved_vs_default_usd === "number" ? row.saved_vs_default_usd : undefined,
      defaultModel: row.default_model ?? null,
    };
    setMessages((prev) => {
      if (prev.some((m) => m.id === row.id)) return prev;
      const next = [...prev];
      const placeholderId = pendingPlaceholderRef.current;
      const idx = placeholderId ? next.findIndex((m) => m.id === placeholderId) : -1;
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          id: row.id,
          agent,
          text,
          thinking: false,
          meta,
          toolCalls,
          diffs,
          plans,
          verifications,
          delegations,
        };
        pendingPlaceholderRef.current = null;
        pendingUserMessageIdRef.current = null;
      } else {
        next.push({
          id: row.id,
          agent,
          text,
          meta,
          toolCalls,
          diffs,
          plans,
          verifications,
          delegations,
        });
      }
      return next;
    });
    streamIdRef.current = null;
    setStatus("ready");
    setComposerNotice("");
    textareaRef.current?.focus();
  }, []);

  // Realtime thread subscription
  useEffect(() => {
    if (!threadId) return;
    void fetchThreadMessages(threadId).then((rows) => {
      rows.forEach((row) => {
        if (pendingPlaceholderRef.current || pendingUserMessageIdRef.current) ingestAgentRow(row);
        else seenMessageIdsRef.current.add(row.id);
      });
    });
    const unsub = subscribeThread(threadId, {
      onMessage: ingestAgentRow,
      onError: (err) => console.warn("[UnifiedChat] thread stream error:", err),
    });
    return unsub;
  }, [ingestAgentRow, threadId]);

  const charCount = draft.length;
  const overLimit = charCount > MAX_CHARS;
  const busy = status === "submitted" || status === "streaming";

  // 3.9.7 — Global Router pre-send preview (debounced).
  const [routerPreview, setRouterPreview] = useState<RouterPreview | null>(null);
  useEffect(() => {
    const prompt = draft.trim();
    if (!prompt || prompt.length < 8) {
      setRouterPreview(null);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      const agent = resolveAgent(prompt, selectedAgent);
      const res = await previewRoute(prompt, agent, ctrl.signal);
      if (!ctrl.signal.aborted) setRouterPreview(res);
    }, 400);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [draft, selectedAgent]);

  const executePrompt = useCallback(
    (prompt: string) => {
      const targetAgent = resolveAgent(prompt, selectedAgent);
      const targetMeta = AGENT_META[targetAgent];
      const placeholderId = `j-${Date.now() + 1}`;
      const startedAt = Date.now();
      const routedModel = routerPreview?.model ?? null;
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
        {
          id: placeholderId,
          agent: targetAgent,
          text: "",
          thinking: true,
          activity: [
            {
              id: "connect",
              kind: "connect",
              label: `${targetMeta.name} stream open`,
              detail: `${project} · ${environment}`,
              at: startedAt,
              status: "running",
            },
          ],
          sourcePrompt: prompt,
          meta: { createdAt: now },
        },
      ]);
      setAttachments([]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Live activity log — har step real SSE event se aata hai, koi fake nahi.
      const pushStep = (
        id: string,
        kind: ActivityKind,
        label: string,
        detail?: string,
        status: ActivityStep["status"] = "running",
      ) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== placeholderId) return m;
            const list = m.activity ? [...m.activity] : [];
            const i = list.findIndex((s) => s.id === id);
            const step: ActivityStep = {
              id,
              kind,
              label,
              detail,
              at: i >= 0 ? list[i].at : Date.now(),
              status,
            };
            if (i >= 0) list[i] = step;
            else list.push(step);
            return { ...m, activity: list };
          }),
        );
      };
      const settleStep = (id: string, status: ActivityStep["status"] = "ok") => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId && m.activity
              ? {
                  ...m,
                  activity: m.activity.map((s) => (s.id === id ? { ...s, status } : s)),
                }
              : m,
          ),
        );
      };
      const settleAll = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId && m.activity
              ? {
                  ...m,
                  activity: m.activity.map((s) =>
                    s.status === "running" ? { ...s, status: "ok" } : s,
                  ),
                  thoughtMs: Date.now() - startedAt,
                }
              : m,
          ),
        );
      };
      let firstToken = false;

      if (targetAgent !== "jimmy" && targetAgent !== "sherlock") {
        pushStep("route", "route", `Routed → ${targetMeta.name}`, targetMeta.subtitle, "ok");
        void routeToAdvisor(project, targetAgent, `${prompt}${attachmentNote}`)
          .then((result) => {
            if (!result?.answer) throw new Error(`${targetMeta.name} route ne jawab return nahi kiya.`);
            pushStep("answer", "answer", "Answer delivered", result.model ?? undefined, "ok");
            settleAll();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? {
                      ...m,
                      agent: targetAgent,
                      text: cleanAgentText(result.answer),
                      thinking: false,
                      meta: { ...m.meta, model: result.model },
                    }
                  : m,
              ),
            );
            pendingPlaceholderRef.current = null;
            streamIdRef.current = null;
            setComposerNotice("");
          })
          .catch((err) => {
            pushStep("stream-error", "error", "Advisor route failed", String(err), "error");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? { ...m, text: `${targetMeta.name}: ${err instanceof Error ? err.message : String(err)}`, thinking: false }
                  : m,
              ),
            );
            pendingPlaceholderRef.current = null;
          })
          .finally(() => {
            abortRef.current = null;
            setStatus("ready");
            textareaRef.current?.focus();
          });
        return;
      }

      // Silence watchdog — agar brain 90s tak kuch na bheje to bubble ko readable
      // error bana do; "connect…" par hamesha ke liye atkna mana hai.
      let watchdog = 0;
      const clearWatchdog = () => {
        if (watchdog) window.clearTimeout(watchdog);
        watchdog = 0;
      };
      const bumpWatchdog = () => {
        clearWatchdog();
        watchdog = window.setTimeout(() => {
          if (pendingPlaceholderRef.current !== placeholderId) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId && (m.thinking || !m.text.trim())
                ? {
                    ...m,
                    text: `${targetMeta.name} brain ne 90s tak koi token nahi bheja — stream timeout. Brain logs check karo, phir dobara bhejo.`,
                    thinking: false,
                  }
                : m,
            ),
          );
          pendingPlaceholderRef.current = null;
          streamIdRef.current = null;
          setStatus("ready");
          setComposerNotice("Stream timeout — brain silent raha.");
          ctrl.abort();
        }, 90_000);
      };
      bumpWatchdog();

      void streamChatWithAgent(
        targetAgent,
        { projectId: project, threadId, prompt: `${prompt}${attachmentNote}`, streamId },
        {
          onAck: (ack) => {
            bumpWatchdog();
            settleStep("connect", "ok");
            pushStep(
              "route",
              "route",
              `Routed → ${targetMeta.name} (${targetMeta.subtitle.toLowerCase()})`,
              ack.threadId ? `thread ${String(ack.threadId).slice(0, 8)}` : undefined,
              "ok",
            );
            if (!threadId && ack.threadId) setThreadId(ack.threadId);
            if (ack.userMessageId) pendingUserMessageIdRef.current = ack.userMessageId;
            setComposerNotice(`${targetMeta.name} live token stream.`);
          },
          onToken: (delta) => {
            bumpWatchdog();
            if (!firstToken) {
              firstToken = true;
              pushStep("write", "token", "Writing answer", undefined, "running");
            }
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== placeholderId) return m;
                const current =
                  m.text === "Live stream connect…" || m.text === "Audit stream connect…"
                    ? ""
                    : m.text;
                return { ...m, text: current + delta, thinking: true };
              }),
            );
          },
          onReplace: (text) => {
            bumpWatchdog();
            setMessages((prev) =>
              prev.map((m) => (m.id === placeholderId ? { ...m, text, thinking: true } : m)),
            );
          },
          onDone: (done) => {
            clearWatchdog();
            settleStep("write", "ok");
            pushStep("answer", "answer", "Answer delivered", undefined, "ok");
            settleAll();
            if (done.assistantMessageId) seenMessageIdsRef.current.add(done.assistantMessageId);
            const cleaned = cleanAgentText(done.assistantText ?? "");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? {
                      ...m,
                      id: done.assistantMessageId ?? placeholderId,
                      agent: targetAgent,
                      text: cleaned || cleanAgentText(m.text),
                      thinking: false,
                    }
                  : m,
              ),
            );
            pendingPlaceholderRef.current = null;
            pendingUserMessageIdRef.current = null;
            streamIdRef.current = null;
            setStatus("ready");
            setComposerNotice("");
            textareaRef.current?.focus();

            // Explainability + workspace memory WRITE path (no more "bridge pending").
            const finalId = done.assistantMessageId ?? placeholderId;
            const answer = cleaned || "";
            void recordExplanation({
              projectId: project,
              messageId: finalId,
              why: `${targetMeta.name} ne founder prompt "${prompt.slice(0, 160)}" par ${Math.round((Date.now() - startedAt) / 1000)}s mein jawab diya.`,
              model: routedModel,
              chain: [
                { id: "c1", index: 0, label: "Stream open", kind: "route", detail: `${project} · ${environment}` },
                { id: "c2", index: 1, label: `${targetMeta.name} response`, kind: "plan", detail: null },
                { id: "c3", index: 2, label: "Answer delivered", kind: "answer", detail: `${answer.length} chars` },
              ],
              tools: [],
              memoryTitle: prompt.slice(0, 120),
              memoryContent: answer.slice(0, 4000),
              memoryKind: "episodic",
              memoryImportance: 3,
            }).catch(() => undefined);
          },
          onPing: () => {
            bumpWatchdog();
          },
          onError: (error) => {
            pushStep("stream-error", "error", "Stream warning", error.slice(0, 160), "error");
            setComposerNotice(
              error.includes("timeout")
                ? "Brain timeout — Rust SSE/server logs check karo."
                : `Stream warning: ${error}`,
            );
          },
        },
        { signal: ctrl.signal },
      )
        .catch((err) => {
          if (ctrl.signal.aborted) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? {
                      ...m,
                      text: "Stopped by founder.",
                      thinking: false,
                      thoughtMs: Date.now() - startedAt,
                      activity: (m.activity ?? []).map((s) =>
                        s.status === "running" ? { ...s, status: "error" } : s,
                      ),
                    }
                  : m,
              ),
            );
            if (pendingUserMessageIdRef.current)
              ignoredParentMessageIdsRef.current.add(pendingUserMessageIdRef.current);
            pendingUserMessageIdRef.current = null;
            return;
          }
          console.warn("[UnifiedChat] chatWithAgent failed:", err);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? {
                    ...m,
                    agent: targetAgent,
                    text: `${targetMeta.name}: ${err instanceof Error ? err.message : String(err)}`,
                    thinking: false,
                  }
                : m,
            ),
          );
          void sendBuilderCommand({ projectId: project, branch, environment, prompt }).catch(
            () => undefined,
          );
        })
        .then(() => {
          // Stream close ho gayi par done event nahi aaya — bubble ko kabhi
          // "connect…" par nahi chhodna.
          if (pendingPlaceholderRef.current !== placeholderId) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId && (m.thinking || !m.text.trim())
                ? {
                    ...m,
                    text:
                      m.text.trim() && !m.text.startsWith("Live stream connect") && !m.text.startsWith("Audit stream connect")
                        ? m.text
                        : `${targetMeta.name} stream bina jawab band ho gayi — dobara bhejo (brain logs check karo).`,
                    thinking: false,
                  }
                : m,
            ),
          );
          pendingPlaceholderRef.current = null;
          setStatus("ready");
        })
        .finally(() => {
          clearWatchdog();
          abortRef.current = null;
          if (pendingPlaceholderRef.current !== placeholderId) {
            streamIdRef.current = null;
            setStatus("ready");
            textareaRef.current?.focus();
          }
        });
    },
    [attachments, branch, environment, project, routerPreview?.model, selectedAgent, threadId],
  );

  const submit = useCallback(() => {
    const prompt = draft.trim();
    if (!prompt || overLimit) return;
    // Phase 3.9.5 — prepend Visual Edit context if founder picked an element.
    let final = prompt;
    if (lastVisualEditPick) {
      const p = lastVisualEditPick;
      const ctx = `[Visual Edit] <${p.tag}> selector=\`${p.selector}\`${p.path ? ` at ${p.path}` : ""}${p.text ? ` — "${p.text.slice(0, 80)}"` : ""}`;
      final = `${ctx}\n${prompt}`;
      setLastVisualEditPick(null);
    }
    setDraft("");
    if (busy) {
      setQueue((prev) => [...prev, final]);
      setComposerNotice("Prompt queued — current response pehle complete hogi.");
      return;
    }
    setStatus("submitted");
    executePrompt(final);
  }, [busy, draft, executePrompt, overLimit, lastVisualEditPick, setLastVisualEditPick]);

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
    if (pendingUserMessageIdRef.current)
      ignoredParentMessageIdsRef.current.add(pendingUserMessageIdRef.current);
    pendingPlaceholderRef.current = null;
    pendingUserMessageIdRef.current = null;
    setStatus("ready");
    setComposerNotice("Response stopped.");
    textareaRef.current?.focus();
  }, []);

  // 3.9.1 — retry an assistant message by re-running its sourcePrompt.
  const retry = useCallback(
    (sourcePrompt: string) => {
      if (busy || !sourcePrompt) return;
      setStatus("submitted");
      executePrompt(sourcePrompt);
    },
    [busy, executePrompt],
  );

  // 3.9.1 — session token meter (sum of assistant tokens on this thread).
  // Blended per-model USD estimate; conservative for OpenRouter/Groq mix used by Jimmy/Sherlock.
  const sessionTokens = useMemo(() => {
    let inTok = 0,
      outTok = 0,
      usd = 0;
    for (const m of messages) {
      const ti = m.meta?.tokensIn ?? 0;
      const to = m.meta?.tokensOut ?? 0;
      inTok += ti;
      outTok += to;
      const model = (m.meta?.model ?? "").toLowerCase();
      // rough per-1M-token pricing (USD)
      let pIn = 0.6,
        pOut = 2.4;
      if (model.includes("hermes") && model.includes("405")) {
        pIn = 3.0;
        pOut = 3.0;
      } else if (model.includes("qwen3-coder") || model.includes("qwen-3-coder")) {
        pIn = 0.9;
        pOut = 0.9;
      } else if (model.includes("deepseek-r1") || model.includes("deepseek/r1")) {
        pIn = 0.55;
        pOut = 2.19;
      } else if (model.includes("gpt-oss-120b")) {
        pIn = 0.15;
        pOut = 0.6;
      } else if (model.includes("llama-3.3-70b") || model.includes("llama3.3-70b")) {
        pIn = 0.12;
        pOut = 0.3;
      } else if (model.includes("groq")) {
        pIn = 0.1;
        pOut = 0.4;
      }
      usd += (ti / 1_000_000) * pIn + (to / 1_000_000) * pOut;
    }
    return { inTok, outTok, total: inTok + outTok, usd };
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
    const base = MENTIONS.filter((m) => m.tag.startsWith(q));
    // 10.12 — industry advisors join the same picker (no duplicate popover).
    return base;
  }, [draft]);

  /** 10.12 — which advisor the current draft routes to (badge in composer). */
  const routedAdvisor = useMemo(() => detectMentionedAdvisor(draft), [draft]);

  const applySlash = useCallback(
    (cmd: string) => {
      const rest = draft.trimStart().replace(/^\S+/, "").trim();
      setDraft(rest ? `${cmd} ${rest}` : `${cmd} `);
      textareaRef.current?.focus();
    },
    [draft],
  );

  const applyMention = useCallback((tag: string) => {
    setDraft((prev) => prev.replace(/(^|\s)@(\w*)$/, (_, lead) => `${lead}${tag} `));
    textareaRef.current?.focus();
  }, []);

  const onAttach = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
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
    },
    [project],
  );

  const startVoice = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === "undefined"
    ) {
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

      // Wire Web Audio analyser for cinematic waveform.
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ac = new AC();
        audioContextRef.current = ac;
        const src = ac.createMediaStreamSource(stream);
        const node = ac.createAnalyser();
        node.fftSize = 128;
        node.smoothingTimeConstant = 0.75;
        src.connect(node);
        setAnalyser(node);
      } catch {
        /* analyser optional */
      }

      recorder.start();
      setRecording(true);
      setComposerNotice("Recording… release mic to transcribe.");
    } catch (err) {
      setComposerNotice(err instanceof Error ? err.message : "Mic permission failed.");
    }
  }, []);

  const teardownAudio = useCallback(() => {
    setRecording(false);
    setAnalyser(null);
    const ac = audioContextRef.current;
    if (ac && ac.state !== "closed") void ac.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  /** 10.3 — swipe-down cancel: discard the recording without transcribing. */
  const cancelVoice = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    voiceChunksRef.current = [];
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
      };
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    teardownAudio();
    setCancelArmed(false);
    voiceStartYRef.current = null;
    setComposerNotice("Voice cancelled.");
  }, [teardownAudio]);

  const stopVoice = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      teardownAudio();
      return;
    }
    recorder.onstop = async () => {
      const audio = new Blob(voiceChunksRef.current, { type: "audio/webm" });
      recorder.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      teardownAudio();
      setComposerNotice("Transcribing voice…");
      try {
        const text = await transcribeVoice(project, audio);
        if (!text) {
          setComposerNotice("Voice transcript empty.");
          return;
        }
        // 3.9.6 — Voice deploy: intent detected → auto-execute slash command.
        const intent = detectVoiceIntent(text);
        if (intent && !busy) {
          setDraft("");
          setStatus("submitted");
          setComposerNotice(`Voice → ${intent.slash} · executing…`);
          executePrompt(intent.prompt);
        } else {
          setDraft((prev) => `${prev}${prev ? " " : ""}${text}`);
          setComposerNotice(
            intent ? `Voice → ${intent.slash} queued (agent busy).` : "Voice inserted.",
          );
        }
      } catch (err) {
        setComposerNotice(err instanceof Error ? err.message : "Voice endpoint pending.");
      } finally {
        textareaRef.current?.focus();
      }
    };
    recorder.stop();
  }, [busy, executePrompt, project, teardownAudio]);

  // Keyboard navigation on message list (and Ctrl/Cmd+Arrow from anywhere inside chat)
  const onListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const el = messagesRef.current;
      if (!el) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          scrollByDelta(SCROLL_STEP / 3);
          break;
        case "ArrowUp":
          e.preventDefault();
          scrollByDelta(-SCROLL_STEP / 3);
          break;
        case "PageDown":
          e.preventDefault();
          scrollByDelta(el.clientHeight * 0.85);
          break;
        case "PageUp":
          e.preventDefault();
          scrollByDelta(-el.clientHeight * 0.85);
          break;
        case "End":
          e.preventDefault();
          scrollToBottom();
          break;
        case "Home":
          e.preventDefault();
          scrollToTop();
          break;
      }
    },
    [scrollByDelta, scrollToBottom, scrollToTop],
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full min-h-0 flex-col bg-background">
        {/* Header */}
        <div className="relative grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914]/40 to-transparent" />
          <div className="flex min-w-0 items-center gap-3">
            <Radio className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/85">
              Build Chat
            </span>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider"
              style={{
                borderColor: `${activeProject.accent}66`,
                background: `${activeProject.accent}1a`,
                color: "#fff",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: activeProject.accent,
                  boxShadow: `0 0 8px ${activeProject.accent}`,
                }}
              />
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
                    in: {sessionTokens.inTok.toLocaleString()} · out:{" "}
                    {sessionTokens.outTok.toLocaleString()}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {sessionTokens.usd > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/[0.06] px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-emerald-300/90">
                    <DollarSign className="h-2.5 w-2.5" />
                    {sessionTokens.usd < 0.01
                      ? sessionTokens.usd.toFixed(4)
                      : sessionTokens.usd.toFixed(3)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-[10px] font-mono">
                    Session cost estimate · blended OpenRouter/Groq rates
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">
              {bridgeStatus}
            </span>
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
                  <div className="mb-2 text-[13px] font-semibold text-foreground/90">
                    No messages yet
                  </div>
                  <div className="max-w-[280px] text-[11px] leading-relaxed text-muted-foreground">
                    Jimmy se baat karo ya build command do. Sherlock sirf code change ke baad audit
                    karega.
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

          {/* Red cinematic scroll rail — left edge */}
          <ChatScrollRail targetRef={messagesRef} contentKey={messages.length} />
        </div>

        {/* Composer — pinned bottom */}
        <div className="relative shrink-0 border-t border-border bg-background/75 p-3 backdrop-blur-xl">
          {/* 3.9.1 — voice waveform overlay */}
          <VoiceWaveform analyser={analyser} active={recording} />
          {recording && cancelArmed && (
            <div className="pointer-events-none absolute inset-x-3 bottom-full mb-14 rounded-md border border-[#ff6b73]/40 bg-black/80 px-2 py-1 text-center font-mono text-[10px] uppercase tracking-widest text-[#ff9aa2] backdrop-blur">
              Release to cancel
            </div>
          )}
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
                    <span
                      className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${AGENT_META[c.agent].chip} ring-1 ${AGENT_META[c.agent].ring}`}
                    >
                      {AGENT_META[c.agent].initial}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {c.label}
                    </span>
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
                    {"advisorSlug" in mn && findAdvisor(mn.advisorSlug as string) ? (
                      <span
                        className="grid h-5 w-5 place-items-center rounded text-[9px] font-bold text-black"
                        style={{
                          background: findAdvisor(mn.advisorSlug as string)!.color,
                          boxShadow: `0 0 12px -4px ${findAdvisor(mn.advisorSlug as string)!.color}`,
                        }}
                      >
                        {findAdvisor(mn.advisorSlug as string)!.glyph}
                      </span>
                    ) : (
                      <span
                        className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${AGENT_META[mn.agent].chip} ring-1 ${AGENT_META[mn.agent].ring}`}
                      >
                        {AGENT_META[mn.agent].initial}
                      </span>
                    )}
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {mn.tag}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">{mn.hint}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onAttach} />
          {lastVisualEditPick && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-2 flex items-center gap-2 rounded-lg border border-[#E50914]/30 bg-[#E50914]/[0.06] px-2.5 py-1.5 text-[11px]"
            >
              <MousePointerClick className="h-3 w-3 text-[#ff7480]" />
              <span className="font-mono text-foreground/80">&lt;{lastVisualEditPick.tag}&gt;</span>
              <span className="truncate font-mono text-muted-foreground/70">
                {lastVisualEditPick.selector}
              </span>
              {lastVisualEditPick.text && (
                <span className="truncate text-muted-foreground/60">
                  "{lastVisualEditPick.text.slice(0, 40)}"
                </span>
              )}
              <button
                type="button"
                onClick={() => setLastVisualEditPick(null)}
                className="ml-auto grid h-5 w-5 place-items-center rounded hover:bg-white/[0.06]"
                title="Clear visual edit context"
              >
                <XIcon className="h-3 w-3 text-muted-foreground" />
              </button>
            </motion.div>
          )}
          {routedAdvisor && (
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <AdvisorBadge advisor={routedAdvisor} thinking={busy} />
            </div>
          )}
          <PromptInput
            className="rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  (e.currentTarget as HTMLTextAreaElement).blur();
                  return;
                }
                if (
                  (e.ctrlKey || e.metaKey) &&
                  (e.key === "ArrowUp" ||
                    e.key === "ArrowDown" ||
                    e.key === "PageUp" ||
                    e.key === "PageDown" ||
                    e.key === "Home" ||
                    e.key === "End")
                ) {
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
              placeholder={`Message ${AGENT_META[selectedAgent].name}…`}
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="h-8 gap-2 bg-accent/30 px-2.5 text-[11px]">
                        <span className={`grid h-4 w-4 place-items-center rounded text-[9px] ${AGENT_META[selectedAgent].chip}`}>
                          {AGENT_META[selectedAgent].initial}
                        </span>
                        {AGENT_META[selectedAgent].name}
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-64">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Choose AI
                      </DropdownMenuLabel>
                      {(["jimmy", "sherlock"] as UnifiedAgentSlug[]).map((slug) => (
                        <DropdownMenuItem key={slug} onSelect={() => setSelectedAgent(slug)}>
                          <span className={`grid h-5 w-5 place-items-center rounded text-[9px] ${AGENT_META[slug].chip}`}>
                            {AGENT_META[slug].initial}
                          </span>
                          <span className="flex-1 text-xs">{AGENT_META[slug].name}</span>
                          <span className="text-[9px] text-muted-foreground">{AGENT_META[slug].subtitle}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      {ADVISORS.map((advisor) => (
                        <DropdownMenuItem key={advisor.slug} onSelect={() => setSelectedAgent(advisor.slug as UnifiedAgentSlug)}>
                          <span className="grid h-5 w-5 place-items-center rounded bg-cyan-400/10 text-[9px] text-cyan-200">
                            {advisor.glyph}
                          </span>
                          <span className="flex-1 text-xs">{advisor.name}</span>
                          <span className="text-[9px] text-muted-foreground">{advisor.domain}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => fileInputRef.current?.click()}
                      >
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
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.currentTarget.setPointerCapture?.(e.pointerId);
                          voiceStartYRef.current = e.clientY;
                          setCancelArmed(false);
                          void startVoice();
                        }}
                        onPointerMove={(e) => {
                          if (!recording || voiceStartYRef.current == null) return;
                          setCancelArmed(e.clientY - voiceStartYRef.current > 48);
                        }}
                        onPointerUp={() => {
                          if (cancelArmed) cancelVoice();
                          else stopVoice();
                          voiceStartYRef.current = null;
                          setCancelArmed(false);
                        }}
                        onPointerCancel={cancelVoice}
                      >
                        <Mic
                          className={`h-3.5 w-3.5 ${cancelArmed ? "text-[#ff6b73]" : recording ? "text-[#E50914]" : ""}`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Hold to talk · swipe down to cancel · Urdu/English/Hindi auto-detect
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              <div className="flex items-center gap-2">
                {queue.length > 0 && (
                  <span className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Queue {queue.length}
                  </span>
                )}
                <span className={`relative inline-flex ${busy ? "fb-submit-shimmer" : ""}`}>
                  <PromptInputSubmit
                    status={status}
                    disabled={!draft.trim() || overLimit}
                    onStop={stop}
                  >
                    {status === "ready" ? <Send className="h-3.5 w-3.5" /> : undefined}
                  </PromptInputSubmit>
                </span>
              </div>
            </PromptInputFooter>
          </PromptInput>
          {(composerNotice || attachments.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-[10px] text-muted-foreground/70">
              {composerNotice && (
                <span className="font-mono uppercase tracking-wider">{composerNotice}</span>
              )}
              {attachments.map((file) => (
                <span
                  key={`${file.url}-${file.name}`}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1"
                >
                  {file.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[10px] uppercase tracking-widest text-muted-foreground/45">
            <span className="font-mono">
              Phase 3.9 ·{" "}
              {busy
                ? messages
                    .slice()
                    .reverse()
                    .find((m) => m.thinking)?.agent === "sherlock"
                  ? "auditing"
                  : "streaming"
                : "ready"}
            </span>
            {routerPreview && !busy && (
              <span
                className="hidden items-center gap-1.5 rounded-md border border-emerald-400/25 bg-emerald-400/[0.06] px-1.5 py-0.5 font-mono text-emerald-300/90 sm:inline-flex"
                title={`${routerPreview.reason} · default ${shortModelTag(routerPreview.default_model) ?? "—"}`}
              >
                <Zap className="h-2.5 w-2.5" />
                <span>→ {shortModelTag(routerPreview.model) ?? routerPreview.model}</span>
                {routerPreview.est_saved_usd > 0 && (
                  <span className="text-emerald-200/90">
                    save {formatUsd(routerPreview.est_saved_usd)}
                  </span>
                )}
              </span>
            )}
            <span
              className={`font-mono ${overLimit ? "text-red-400" : charCount > MAX_CHARS * 0.9 ? "text-amber-400" : "text-muted-foreground/50"}`}
            >
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
    ? msg.meta.model
        .split("/")
        .slice(-1)[0]
        .replace(/-instruct$|:free$/gi, "")
    : null;
  const activity = msg.activity ?? [];
  const displayText = msg.thinking ? msg.text : cleanAgentText(msg.text);
  const hasStructuredContent = Boolean(
    msg.plans?.length ||
    msg.verifications?.length ||
    msg.delegations?.length ||
    msg.toolCalls?.length ||
    msg.diffs?.length,
  );

  if (!displayText && !hasStructuredContent && activity.length === 0) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
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
      <div
        className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border text-[11px] font-bold ${m.chip} ring-1 ${m.ring}`}
      >
        {m.initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex min-w-0 select-none items-center gap-2" aria-hidden="true">
          <span className="text-[13px] font-semibold">{m.name}</span>
          <span className="truncate text-[10px] uppercase tracking-widest text-muted-foreground/55">
            {m.subtitle}
          </span>
          {msg.meta?.createdAt && (
            <span className="ml-auto shrink-0 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
              {relTime(msg.meta.createdAt)}
            </span>
          )}
        </div>
        {activity.length > 0 && (
          <ThinkingLog
            steps={activity}
            running={Boolean(msg.thinking)}
            thoughtMs={msg.thoughtMs}
            startedAt={activity[0]?.at}
          />
        )}
        {displayText ? (
          <MessageResponse>{displayText}</MessageResponse>
        ) : msg.thinking && activity.length === 0 ? (
          <Shimmer className="text-[14px]" duration={2}>
            Stream open…
          </Shimmer>
        ) : null}

        {/* 3.10.2 — Jimmy Planning Tree (Goal → Tasks → Verification) */}
        {msg.plans?.map((p, i) => (
          <PlanningTree key={p.plan_id ?? `plan-${i}`} plan={p} />
        ))}

        {/* 3.10.2 — Sherlock self-verification loop */}
        {msg.verifications?.map((v, i) => (
          <SelfVerifyLoop key={v.verify_id ?? `verify-${i}`} verification={v} />
        ))}

        {/* 3.10.2 — Jimmy sub-agent delegation tree */}
        {msg.delegations?.map((d, i) => (
          <DelegationTree key={d.delegation_id ?? `deleg-${i}`} delegation={d} />
        ))}

        {/* 3.9.1 — tool_call cards (Rust runtime parts) */}
        {msg.toolCalls?.map((tc) => (
          <ToolCallBubble key={tc.id} tool={tc} onAbort={abortToolCall} />
        ))}

        {/* 3.9.1 — diff previews with approve/reject */}
        {msg.diffs?.map((d, i) => (
          <DiffPreview key={d.diff_id ?? `${d.path}-${i}`} diff={d} />
        ))}

        {/* 3.10.3 — batch diff approval (Monaco side-by-side + Sherlock verdict) */}
        {msg.diffs && msg.diffs.length > 1 && <DiffBatchReview diffs={msg.diffs} />}

        {/* meta chips + hover actions */}
        {isAssistant && !msg.thinking && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {modelShort && (
              <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
                {modelShort}
              </span>
            )}
            {msg.meta?.tokensIn ? (
              <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">
                {msg.meta.tokensIn.toLocaleString()} in
              </span>
            ) : null}
            {msg.meta?.tokensOut ? (
              <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">
                {msg.meta.tokensOut.toLocaleString()} out
              </span>
            ) : null}
            {typeof msg.meta?.costUsd === "number" && msg.meta.costUsd > 0 && (
              <span className="rounded-md border border-[#E50914]/30 bg-[#E50914]/[0.06] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#ff7480]">
                {msg.meta.costUsd < 0.001
                  ? `$${msg.meta.costUsd.toFixed(5)}`
                  : msg.meta.costUsd < 1
                    ? `$${msg.meta.costUsd.toFixed(4)}`
                    : `$${msg.meta.costUsd.toFixed(2)}`}
              </span>
            )}
            {typeof msg.meta?.savedVsDefaultUsd === "number" && msg.meta.savedVsDefaultUsd > 0 && (
              <span
                className="rounded-md border border-emerald-400/30 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-emerald-300"
                title={`Saved vs default${msg.meta.defaultModel ? ` (${msg.meta.defaultModel.split("/").slice(-1)[0]})` : ""}`}
              >
                saved{" "}
                {msg.meta.savedVsDefaultUsd < 0.001
                  ? `$${msg.meta.savedVsDefaultUsd.toFixed(5)}`
                  : `$${msg.meta.savedVsDefaultUsd.toFixed(4)}`}
              </span>
            )}
            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={copy}
                    className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
              </Tooltip>
              {canRetry && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onRetry(msg.sourcePrompt!)}
                      className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                    >
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
