/**
 * Phase A.1 — Builder-side proxy route for Jimmy/Sherlock chat.
 *
 * Split (3-process-split-LOCKED Option B + Jun 24 2026 finalization):
 *   - This repo = UI + thin proxy + ALL Supabase 3 writes.
 *   - Rust hostflow-engine :8088 = PURE COMPUTE brain (stateless, no Supabase).
 *     Route: POST /api/agents/:agent/chat  body: { message: string }
 *     Returns: JSON (ensemble result — text extracted defensively below).
 *   - hostflow-server = files/projects/deploy bridge.
 *
 * Flow:
 *   1. Validate slug + body.
 *   2. Ensure thread row in `agent_threads`.
 *   3. Insert user message into `agent_thread_messages`.
 *   4. Return ACK immediately so UI can stay fast.
 *   5. Continue Rust ensemble in background and insert assistant row when ready.
 *      UnifiedChat Realtime sub picks up the assistant row instantly.
 *
 * Env required on Hetzner (pm2 axonetis-builder):
 *   SUPABASE3_URL, SUPABASE3_SERVICE_ROLE_KEY
 *   RUST_BRAIN_URL (default http://127.0.0.1:8088)
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const ALLOWED_SLUGS = new Set(["jimmy", "sherlock"]);
const RUST_TIMEOUT_MS = 45_000;
const BRAIN_ATTEMPT_TIMEOUT_MS = 15_000;
const DIRECT_FALLBACK_TIMEOUT_MS = 30_000;
const MAX_SHERLOCK_LOOPS = 3;
const DISABLED_PROVIDER_IDS = ["J-bk-deepseek-v31-fr", "S-bk-llama-70b-fr"];
const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "qwen/qwen-2.5-coder-32b": { in: 0.18, out: 0.18 },
  "qwen/qwen-2.5-coder-32b-instruct": { in: 0.18, out: 0.18 },
  "qwen/qwen3-32b": { in: 0.18, out: 0.18 },
  "meta-llama/llama-3.3-70b-instruct": { in: 0.23, out: 0.4 },
  "deepseek/deepseek-r1": { in: 0.55, out: 2.19 },
  "deepseek/deepseek-r1:free": { in: 0, out: 0 },
  "deepseek/deepseek-chat-v3.1:free": { in: 0, out: 0 },
  "anthropic/claude-3.5-sonnet": { in: 3, out: 15 },
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "openai/gpt-oss-120b": { in: 0.15, out: 0.6 },
  "llama-3.3-70b-versatile": { in: 0.23, out: 0.4 },
};
const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

type ChatBody = {
  projectId?: string;
  threadId?: string | null;
  prompt?: string;
  streamId?: string;
  stream?: boolean;
};

type BrainJob = {
  supabase: SupabaseClient;
  slug: string;
  prompt: string;
  projectId: string;
  threadId: string;
  userMessageId: string;
  userId: string;
  brainURLs: string[];
  signal?: AbortSignal;
};

type CompletionMeta = {
  model?: string | null;
  tokensIn?: number;
  tokensOut?: number;
};

type ProjectFileSnapshot = {
  path: string;
  content: string | null;
};

type PatchOperation = {
  path: string;
  content?: string;
  action?: "upsert" | "delete";
};

const sseEncoder = new TextEncoder();

function sseFrame(event: string, data: unknown) {
  return sseEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function isBackgroundSherlockAudit(slug: string, prompt: string) {
  return slug === "sherlock" && prompt.trim().startsWith("SHERLOCK AUTO-AUDIT");
}

function hasProviderKeyFailure(text: string | null | undefined) {
  if (!text) return false;
  return /all providers failed|no key|missing.*key|provider.*failed/i.test(text);
}

const GREETING_LINE_RE =
  /^\s*(?:hi+|hello+|hey+|greetings|salam|salaam|assalam[\s-]?o?[\s-]?alaikum|as-?salamu\s+alaikum)\b/i;
const SELF_INTRO_RE =
  /\b(?:jimmy|sherlock(?:review)?)\s+(?:here|hoon|hun)\b|\bi(?:'m| am)\s+(?:jimmy|sherlock)\b|\blead builder (?:at|of|for)\b/i;
const OFFER_FILLER_RE =
  /(?:what(?:'s| is)\s+(?:the\s+)?priority|what can i (?:assist|help)|how can i (?:assist|help)|let me know (?:what|if|when)|ready (?:to help|for (?:today|your|the)|ho ja(?:o|ye))|kya aap kuch specific|agla step bata(?:o|ayein)|anything else i can)/i;
const STATUS_RECAP_RE =
  /(?:runtime is stable|showing normal ops|still deferred|audit ready on demand|ready for today'?s build update|build update)/i;
const ROMAN_URDU_RE =
  /\b(?:hai|hain|hoga|hogi|hogay|kero|karo|karna|karni|nahi|nahin|bhai|mujhe|tumhe|tumhari|tum|kya|abhi|phir|shuru|acha|theek|banao|bana|banaya|chalao|dekho|batao|bolo|kiya|liye|wala|wali|se|ka|ke|ki)\b/gi;

function romanUrduScore(text: string) {
  return (text.match(ROMAN_URDU_RE) ?? []).length;
}

function mismatchedLanguage(prompt: string, text: string | null | undefined) {
  if (!text) return false;
  const body = text.trim();
  if (body.length < 40) return false;
  return romanUrduScore(prompt) >= 3 && romanUrduScore(body) === 0;
}

function violatesFounderVoice(text: string | null | undefined) {
  if (!text) return false;
  const body = text.trim();
  if (!body) return false;
  const firstLine = body.split("\n", 1)[0] ?? "";
  if (GREETING_LINE_RE.test(firstLine)) return true;
  if (SELF_INTRO_RE.test(body)) return true;
  if (OFFER_FILLER_RE.test(body)) return true;
  if (STATUS_RECAP_RE.test(body)) return true;
  if (/\bhi there\b/i.test(body)) return true;
  const trademarks = (body.match(/™/g) ?? []).length;
  if (trademarks >= 2 && body.length < 900) return true;
  return false;
}

function isFillerLine(line: string) {
  const s = line.trim();
  if (!s) return false;
  return (
    GREETING_LINE_RE.test(s) ||
    SELF_INTRO_RE.test(s) ||
    OFFER_FILLER_RE.test(s) ||
    STATUS_RECAP_RE.test(s)
  );
}

/** Cheap deterministic cleanup: drop greeting/offer filler at the edges. */
function stripFounderVoiceFiller(text: string) {
  const lines = text.split("\n");
  while (lines.length && (!lines[0]!.trim() || isFillerLine(lines[0]!))) lines.shift();
  while (lines.length && (!lines[lines.length - 1]!.trim() || isFillerLine(lines[lines.length - 1]!)))
    lines.pop();
  return lines.join("\n").trim();
}

function founderVoiceRewritePrompt(slug: string, prompt: string, draft: string) {
  return [
    founderCommunicationContract(slug),
    "",
    "TASK: neeche diya gaya DRAFT founder communication contract todta hai (greeting / self-intro / status recap / offer-to-help / English-only). Usay dobara likho founder ke apne style mein: natural Roman Urdu/Hindi, seedha point se shuru, koi greeting nahi, koi intro nahi, koi 'what's the priority' type sawaal nahi. Technical facts, commands, paths, code aur error text bilkul waise hi rakho. Sirf rewritten jawab do — koi explanation ya quotes nahi.",
    "",
    `FOUNDER MESSAGE:\n${prompt}`,
    "",
    `DRAFT:\n${draft}`,
  ].join("\n");
}

/**
 * Final gate before anything reaches the founder: strip filler, and if the text
 * still breaks the contract, force a rewrite through the direct model chain.
 */
async function enforceFounderVoice(
  slug: string,
  prompt: string,
  text: string,
  signal?: AbortSignal,
): Promise<{ text: string; meta?: CompletionMeta }> {
  if (!text?.trim()) return { text };
  if (text.startsWith("⚠️")) return { text };

  let candidate = text;
  if (violatesFounderVoice(candidate)) {
    const stripped = stripFounderVoiceFiller(candidate);
    if (stripped && !violatesFounderVoice(stripped)) candidate = stripped;
  }
  if (!violatesFounderVoice(candidate) && !mismatchedLanguage(prompt, candidate)) {
    return { text: candidate };
  }

  const rewritten = await runDirectFallback(
    slug,
    founderVoiceRewritePrompt(slug, prompt, text),
    signal,
  );
  if (rewritten && "text" in rewritten && rewritten.text) {
    return {
      text: rewritten.text,
      meta: {
        model: rewritten.model,
        tokensIn: rewritten.tokensIn,
        tokensOut: rewritten.tokensOut,
      },
    };
  }

  const stripped = stripFounderVoiceFiller(candidate);
  return { text: stripped || candidate };
}


function providerEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function normalizeModelLabel(model: string | null | undefined) {
  if (!model) return "unknown";
  return model.replace(/^(openrouter|groq|ollama):/i, "").trim();
}

function priceFor(model: string | null | undefined) {
  const normalized = normalizeModelLabel(model);
  return (
    MODEL_PRICING[normalized] ??
    MODEL_PRICING[normalized.replace(/:free$/i, "")] ?? { in: 0.6, out: 2.4 }
  );
}

function completionMeta(prompt: string, assistantText: string, meta?: CompletionMeta) {
  const model = normalizeModelLabel(meta?.model);
  const tokensIn = meta?.tokensIn && meta.tokensIn > 0 ? meta.tokensIn : estimateTokenCount(prompt);
  const tokensOut =
    meta?.tokensOut && meta.tokensOut > 0 ? meta.tokensOut : estimateTokenCount(assistantText);
  const chosen = priceFor(model);
  const baseline = priceFor(DEFAULT_MODEL);
  const costUsd = (tokensIn * chosen.in + tokensOut * chosen.out) / 1_000_000;
  const defaultCostUsd = (tokensIn * baseline.in + tokensOut * baseline.out) / 1_000_000;
  return {
    model,
    tokensIn,
    tokensOut,
    costUsd: Number(costUsd.toFixed(6)),
    savedVsDefaultUsd: Number(Math.max(0, defaultCostUsd - costUsd).toFixed(6)),
  };
}

function modelsFromEnv(envName: string, fallback: string[]) {
  const configured = process.env[envName]
    ?.split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return configured?.length ? configured : fallback;
}

function directSystemPrompt(slug: string) {
  if (slug === "sherlock") {
    return "You are SherlockReview, AXONETIS AI Builder's strict audit/debug agent. Founder Muhammad Nauman Sherwani se natural Roman Urdu/Hindi mixed with necessary technical English mein baat karo. Seedha root cause aur verified result do. Generic greeting, corporate intro, filler, repeated offer-to-help, fake backend result, ya English-only reply kabhi nahi. Agar kaam adhura ho to clearly bolo. Founder ke tone aur message length ko mirror karo.";
  }
  return "Tu Jimmy hai — NEXATECT ka lead builder aur Founder Muhammad Nauman Sherwani ka trusted technical partner. Founder se bilkul natural Roman Urdu/Hindi mein baat kar, sirf zaroori technical terms English mein rakh. Seedha jawab ya action se shuru kar; 'Hi there', apna intro, corporate pitch, generic greeting, repeated offer-to-help aur English-only paragraph kabhi mat likh. Founder ke tone aur message length ko mirror kar. Jo verify hua ho sirf woh complete bol; jo pending ho usay pending bol. Over-confident claim, dummy result aur banawati success mana hai. Default reply short rakho; detail sirf founder maange ya technical safety ke liye zaroori ho. Yeh live founder conversation hai, customer support chat nahi.";
}

function founderCommunicationContract(slug: string) {
  return [
    directSystemPrompt(slug),
    "Response contract (strict): final answer only; no hidden reasoning or self-talk; no generic welcome; no closing question unless a real founder decision is blocked; preserve exact commands, paths, errors, and code identifiers; use clean Markdown when useful.",
  ].join("\n");
}

function brainPrompt(slug: string, prompt: string) {
  return `${founderCommunicationContract(slug)}\n\nFounder ka current message:\n${prompt}`;
}

function needsBuilderExecution(prompt: string, firstReply: string) {
  if (parsePatchOperations(firstReply).length > 0) return true;
  return /\b(build|banao|bana|implement|create|add|edit|update|change|fix|repair|patch|code|file|component|route|api|sql|migration|deploy|ship|publish|remove|delete|rename|refactor|wire|connect|integrat(?:e|ion)|bug|error)\b/i.test(
    prompt,
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  parentSignal?: AbortSignal,
) {
  const ctrl = new AbortController();
  const abort = () => ctrl.abort(parentSignal?.reason);
  if (parentSignal?.aborted) ctrl.abort(parentSignal.reason);
  else parentSignal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abort);
  }
}

async function callGroqFallback(slug: string, prompt: string, signal?: AbortSignal) {
  const key = providerEnv(
    "GROQ_API_KEY",
    "GROQ_KEY",
    "NEXATECT_GROQ_API_KEY",
    "HOSTFLOW_GROQ_API_KEY",
  );
  if (!key) return null;

  const models = modelsFromEnv(
    slug === "sherlock" ? "AXONETIS_SHERLOCK_GROQ_MODELS" : "AXONETIS_JIMMY_GROQ_MODELS",
    slug === "sherlock"
      ? ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]
      : ["llama-3.3-70b-versatile", "qwen/qwen3-32b", "openai/gpt-oss-120b"],
  );

  let lastError = "";
  for (const model of models) {
    try {
      const r = await fetchWithTimeout(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: directSystemPrompt(slug) },
              { role: "user", content: prompt },
            ],
            temperature: slug === "sherlock" ? 0.2 : 0.45,
          }),
        },
        DIRECT_FALLBACK_TIMEOUT_MS,
        signal,
      );
      if (!r.ok) {
        lastError = `${model}: ${r.status} ${await r.text().catch(() => "")}`.slice(0, 280);
        continue;
      }
      const payload = (await r.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          input_tokens?: number;
          output_tokens?: number;
        };
      } | null;
      const text = payload?.choices?.[0]?.message?.content?.trim();
      if (text && !violatesFounderVoice(text))
        return {
          text,
          model: `groq:${model}`,
          tokensIn: payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens,
          tokensOut: payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens,
        };
      if (text) lastError = `${model}: founder communication contract violated`;
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 280);
    }
  }
  return lastError ? { error: lastError } : null;
}

async function callOpenRouterFallback(slug: string, prompt: string, signal?: AbortSignal) {
  const key = providerEnv(
    "OPENROUTER_API_KEY",
    "OPENROUTER_KEY",
    "NEXATECT_OPENROUTER_API_KEY",
    "HOSTFLOW_OPENROUTER_API_KEY",
  );
  if (!key) return null;

  const models = modelsFromEnv(
    slug === "sherlock"
      ? "AXONETIS_SHERLOCK_OPENROUTER_MODELS"
      : "AXONETIS_JIMMY_OPENROUTER_MODELS",
    slug === "sherlock"
      ? [
          "deepseek/deepseek-r1:free",
          "meta-llama/llama-3.3-70b-instruct:free",
          "qwen/qwen-2.5-coder-32b-instruct",
        ]
      : [
          "qwen/qwen-2.5-coder-32b-instruct",
          "deepseek/deepseek-chat-v3.1:free",
          "meta-llama/llama-3.3-70b-instruct:free",
        ],
  );

  let lastError = "";
  for (const model of models) {
    try {
      const r = await fetchWithTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://axonetis.lovable.app",
            "X-Title": "AXONETIS AI Builder",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: directSystemPrompt(slug) },
              { role: "user", content: prompt },
            ],
            temperature: slug === "sherlock" ? 0.2 : 0.45,
          }),
        },
        DIRECT_FALLBACK_TIMEOUT_MS,
        signal,
      );
      if (!r.ok) {
        lastError = `${model}: ${r.status} ${await r.text().catch(() => "")}`.slice(0, 280);
        continue;
      }
      const payload = (await r.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          input_tokens?: number;
          output_tokens?: number;
        };
      } | null;
      const text = payload?.choices?.[0]?.message?.content?.trim();
      if (text && !violatesFounderVoice(text))
        return {
          text,
          model: `openrouter:${model}`,
          tokensIn: payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens,
          tokensOut: payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens,
        };
      if (text) lastError = `${model}: founder communication contract violated`;
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 280);
    }
  }
  return lastError ? { error: lastError } : null;
}

async function runDirectFallback(slug: string, prompt: string, signal?: AbortSignal) {
  const primary =
    slug === "sherlock"
      ? [callGroqFallback, callOpenRouterFallback]
      : [callGroqFallback, callOpenRouterFallback];
  const errors: string[] = [];
  for (const call of primary) {
    const result = await call(slug, prompt, signal);
    if (!result) continue;
    if ("text" in result && result.text) return result;
    if ("error" in result && result.error) errors.push(result.error);
  }
  return errors.length ? { error: errors.join(" | ").slice(0, 600) } : null;
}

/**
 * Defensive text extraction — Rust `run_ensemble` returns unknown JSON shape.
 * Try common fields, fall back to stringified JSON so the user always sees
 * something instead of a blank bubble.
 */
function extractText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return JSON.stringify(payload);
  const p = payload as Record<string, unknown>;
  const candidates = [
    p.final_answer,
    p.finalAnswer,
    p.text,
    p.content,
    p.best,
    p.reply,
    p.message,
    p.output,
    (p.best as Record<string, unknown> | undefined)?.text,
    (p.best as Record<string, unknown> | undefined)?.content,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  const audit = formatSherlockAudit(p);
  if (audit) return audit;
  return JSON.stringify(payload, null, 2);
}

/**
 * Brain `/sherlock/audit` returns { finalVerdict, auditLoop: [{ attempt,
 * verdict, reasoning, suggestions, confidence }] } instead of a text field.
 * Render it as readable markdown so the chat never shows raw JSON.
 */
function formatSherlockAudit(p: Record<string, unknown>): string | null {
  const loop = p.auditLoop;
  if (!Array.isArray(loop) || loop.length === 0) return null;
  const verdict = typeof p.finalVerdict === "string" ? p.finalVerdict : "RETRY";
  const icon = verdict === "PASS" ? "✅" : verdict === "FAIL" ? "❌" : "⚠️";
  const passes = loop
    .map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const suggestions = Array.isArray(r.suggestions)
        ? r.suggestions.filter((s): s is string => typeof s === "string")
        : [];
      const lines = [
        `**Pass ${r.attempt ?? "?"} — ${r.verdict ?? "?"}** (confidence ${r.confidence ?? "?"})`,
        typeof r.reasoning === "string" ? r.reasoning.trim() : "",
        ...suggestions.map((s) => `- ${s}`),
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");
  return `${icon} **Sherlock audit: ${verdict}**\n\n${passes}`;
}

function extractModel(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const best = p.best as Record<string, unknown> | undefined;
  const candidates = [p.model, p.model_id, p.provider_model, best?.model, best?.model_id];
  for (const c of candidates) if (typeof c === "string" && c.trim()) return c.trim();
  return null;
}

function extractUsage(payload: unknown): { tokensIn?: number; tokensOut?: number } {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const usage = (p.usage ?? (p.best as Record<string, unknown> | undefined)?.usage) as
    | Record<string, unknown>
    | undefined;
  const numberValue = (...keys: string[]) => {
    for (const key of keys) {
      const v = usage?.[key] ?? p[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return undefined;
  };
  return {
    tokensIn: numberValue("prompt_tokens", "input_tokens", "tokens_in"),
    tokensOut: numberValue("completion_tokens", "output_tokens", "tokens_out"),
  };
}

function extractDelta(payload: unknown): string {
  if (typeof payload === "string") return payload === "[DONE]" ? "" : payload;
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const candidates = [
    p.delta,
    p.token,
    p.text,
    p.content,
    (p.message as Record<string, unknown> | undefined)?.content,
    (p.choices as Array<{ delta?: { content?: string }; text?: string }> | undefined)?.[0]?.delta
      ?.content,
    (p.choices as Array<{ delta?: { content?: string }; text?: string }> | undefined)?.[0]?.text,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c) return c;
  }
  return "";
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function resolveBrainURLs() {
  const configured = [
    process.env.RUST_BRAIN_URL,
    process.env.AXONETIS_RUST_BRAIN_URL,
    process.env.HOSTFLOWAI_BRAIN_URL,
    process.env.HOSTFLOW_BRAIN_URL,
  ].flatMap((value) => (value ?? "").split(","));

  return unique([
    ...configured.map((value) => value.trim().replace(/\/$/, "")),
    "http://127.0.0.1:8088",
    "http://127.0.0.1:8080",
  ]);
}

function projectSlugCandidates(projectId: string) {
  const aliases: Record<string, string[]> = {
    hostflowai: ["hostflowai", "nexatect", "founderbuilder", "axonetis"],
    nexatect: ["nexatect", "hostflowai", "founderbuilder", "axonetis"],
    axonetis: ["axonetis", "founderbuilder", "nexatect", "hostflowai"],
    founderbuilder: ["founderbuilder", "axonetis", "nexatect", "hostflowai"],
  };
  return unique([projectId, ...(aliases[projectId] ?? [])]);
}

async function resolveProjectUuid(supabase: SupabaseClient, projectId: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId))
    return projectId;
  const slugs = projectSlugCandidates(projectId);
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug")
    .in("slug", slugs)
    .limit(1);
  if (error) throw error;
  const id = data?.[0]?.id as string | undefined;
  if (!id) throw new Error(`Project not found for agent loop: ${projectId}`);
  return id;
}

async function loadProjectSnapshot(
  supabase: SupabaseClient,
  projectUuid: string,
): Promise<ProjectFileSnapshot[]> {
  const { data, error } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectUuid)
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? [])
    .map((row) => ({
      path: String((row as { path?: unknown }).path ?? ""),
      content: ((row as { content?: unknown }).content as string | null) ?? null,
    }))
    .filter((row) => row.path);
}

function compactSnapshot(files: ProjectFileSnapshot[]) {
  return files
    .slice(0, 40)
    .map((file) => {
      const content = (file.content ?? "").slice(0, 6000);
      return `--- FILE: ${file.path}\n${content}`;
    })
    .join("\n\n");
}

function buildJimmyPatchPrompt(
  founderPrompt: string,
  files: ProjectFileSnapshot[],
  previousAudit?: string,
) {
  return [
    "You are JimmyBuild inside AXONETIS AI Builder. You must make real project file changes.",
    "Return a concise founder-facing summary first, then a machine-readable patch block.",
    "Patch block format is mandatory when code changes are needed:",
    "```axonetis-patch",
    '[{"path":"src/example.tsx","action":"upsert","content":"full file content"}]',
    "```",
    "Rules: only JSON array in the patch block; content must be full file content; no duplicate files; update existing paths where possible.",
    previousAudit ? `Sherlock previous audit to fix:\n${previousAudit}` : "",
    `Founder request:\n${founderPrompt}`,
    "Current project files snapshot:",
    compactSnapshot(files) || "No files loaded yet. Create only the minimum required app files.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildSherlockAuditPrompt(
  founderPrompt: string,
  files: ProjectFileSnapshot[],
  jimmyReply: string,
) {
  return [
    "You are SherlockReview for AXONETIS. Audit Jimmy's proposed/applied builder changes.",
    "Return exactly one verdict line starting with APPROVED or CHANGES_REQUIRED, then concise findings.",
    "Check: real code was changed, no dummy feature, no duplicate paths, request satisfied, syntax likely valid, security sane.",
    `Founder request:\n${founderPrompt}`,
    `Jimmy reply:\n${jimmyReply}`,
    "Current file snapshot after Jimmy pass:",
    compactSnapshot(files),
  ].join("\n\n");
}

function parsePatchOperations(text: string): PatchOperation[] {
  const match = text.match(/```axonetis-patch\s*([\s\S]*?)```/i);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1].trim()) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
      .filter(Boolean)
      .map((item) => ({
        path: String(item!.path ?? "")
          .trim()
          .replace(/^\/+/, ""),
        action: (item!.action === "delete" ? "delete" : "upsert") as PatchOperation["action"],
        content: typeof item!.content === "string" ? item!.content : undefined,
      }))
      .filter((op) => op.path && !op.path.includes("..") && !op.path.startsWith("."));
  } catch {
    return [];
  }
}

function stripPatchBlock(text: string) {
  return text.replace(/```axonetis-patch\s*[\s\S]*?```/gi, "").trim();
}

async function applyPatchOperations(
  job: BrainJob,
  projectUuid: string,
  ops: PatchOperation[],
  iteration: number,
) {
  const applied: string[] = [];
  for (const op of ops.slice(0, 12)) {
    if (op.action === "delete") {
      const { error } = await job.supabase
        .from("project_files")
        .update({ is_deleted: true, updated_by: job.userId })
        .eq("project_id", projectUuid)
        .eq("path", op.path);
      if (error) throw error;
      applied.push(`deleted ${op.path}`);
      continue;
    }
    const content = op.content ?? "";
    const { error } = await job.supabase.from("project_files").upsert(
      {
        project_id: projectUuid,
        path: op.path,
        content,
        size_bytes: new TextEncoder().encode(content).length,
        checksum: sha256(content),
        is_deleted: false,
        updated_by: job.userId,
        version: iteration,
      },
      { onConflict: "project_id,path" },
    );
    if (error) throw error;
    applied.push(`wrote ${op.path}`);
  }
  return applied;
}

async function insertAgentRun(job: BrainJob, fields: Record<string, unknown>) {
  let projectUuid: string;
  try {
    projectUuid = await resolveProjectUuid(job.supabase, job.projectId);
  } catch (err) {
    console.warn(
      "[agent-loop] agent_runs skipped:",
      err instanceof Error ? err.message : String(err),
    );
    return;
  }
  await job.supabase
    .from("agent_runs")
    .insert({
      project_id: projectUuid,
      user_id: job.userId,
      agent: job.slug,
      model: String(fields.model ?? "router"),
      provider: String(fields.provider ?? "axonetis-loop"),
      status: String(fields.status ?? "running"),
      sherlock_loop: Number(fields.sherlock_loop ?? 0),
      input: fields.input ?? { prompt: job.prompt },
      output: fields.output ?? {},
      error: fields.error ? String(fields.error) : null,
      finished_at: fields.finished_at ?? null,
    })
    .then(
      () => null,
      (err) => console.warn("[agent-loop] agent_runs insert skipped:", err.message),
    );
}

async function runCoreBuilderLoop(job: BrainJob, firstReply: string, firstMeta?: CompletionMeta) {
  if (job.slug !== "jimmy")
    return { text: firstReply, meta: firstMeta, applied: [] as string[], audit: "" };
  if (!needsBuilderExecution(job.prompt, firstReply))
    return { text: firstReply, meta: firstMeta, applied: [] as string[], audit: "" };

  const projectUuid = await resolveProjectUuid(job.supabase, job.projectId);
  let files = await loadProjectSnapshot(job.supabase, projectUuid);
  let jimmyReply = firstReply;
  let meta = firstMeta;
  let audit = "";
  const appliedAll: string[] = [];

  await insertAgentRun(job, {
    status: "running",
    sherlock_loop: 0,
    model: meta?.model,
    input: { prompt: job.prompt },
  });

  for (let iteration = 1; iteration <= MAX_SHERLOCK_LOOPS; iteration += 1) {
    if (job.signal?.aborted) break;

    if (iteration > 1 || parsePatchOperations(jimmyReply).length === 0) {
      const rebuildPrompt = buildJimmyPatchPrompt(job.prompt, files, audit);
      const rebuilt = await runDirectFallback("jimmy", rebuildPrompt, job.signal);
      if (rebuilt && "text" in rebuilt && rebuilt.text) {
        jimmyReply = rebuilt.text;
        meta = { model: rebuilt.model, tokensIn: rebuilt.tokensIn, tokensOut: rebuilt.tokensOut };
      }
    }

    const ops = parsePatchOperations(jimmyReply);
    if (ops.length) {
      const applied = await applyPatchOperations(job, projectUuid, ops, iteration);
      appliedAll.push(...applied.map((entry) => `loop ${iteration}: ${entry}`));
      files = await loadProjectSnapshot(job.supabase, projectUuid);
    }

    const auditPrompt = buildSherlockAuditPrompt(job.prompt, files, jimmyReply);
    const verdict = await runDirectFallback("sherlock", auditPrompt, job.signal);
    if (!verdict || !("text" in verdict) || !verdict.text) {
      console.warn(`[agent-loop] Sherlock audit unavailable at loop ${iteration}`);
      break;
    }
    audit = verdict.text;

    await insertAssistantMessage(
      { ...job, slug: "sherlock" },
      `Loop ${iteration}/3 — ${audit}`,
      { model: verdict.model, tokensIn: verdict.tokensIn, tokensOut: verdict.tokensOut },
    );

    if (/^\s*APPROVED\b/i.test(audit)) {
      await insertAgentRun(job, {
        status: "success",
        sherlock_loop: iteration,
        model: meta?.model,
        output: { applied: appliedAll, audit },
        finished_at: new Date().toISOString(),
      });
      break;
    }
  }

  const cleanReply = stripPatchBlock(jimmyReply);
  const summary = [
    cleanReply || (appliedAll.length ? "Project files update ho gayi hain." : "Requested change apply nahi hui."),
    appliedAll.length
      ? `\nApplied files:\n${appliedAll.map((x) => `- ${x}`).join("\n")}`
      : "",
    audit ? `\nSherlock final:\n${audit}` : "",
  ]
    .join("\n")
    .trim();

  return { text: summary, meta, applied: appliedAll, audit };
}

async function safeRunCoreBuilderLoop(
  job: BrainJob,
  firstReply: string,
  firstMeta?: CompletionMeta,
) {
  try {
    return await runCoreBuilderLoop(job, firstReply, firstMeta);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[agent-loop] skipped:", message);
    await insertAgentRun(job, {
      status: "error",
      sherlock_loop: 0,
      model: firstMeta?.model,
      input: { prompt: job.prompt },
      output: { fallback: "assistant_reply_only" },
      error: message,
      finished_at: new Date().toISOString(),
    });
    return {
      text: firstReply,
      meta: firstMeta,
      applied: [] as string[],
      audit: "",
    };
  }
}

async function insertAssistantMessage(job: BrainJob, assistantText: string, meta?: CompletionMeta) {
  const { supabase, slug, threadId, userMessageId, prompt } = job;
  const stamped = completionMeta(prompt, assistantText, meta);
  const baseRow = {
    thread_id: threadId,
    role: "agent" as const,
    agent_slug: slug,
    parts: [{ type: "text", text: assistantText }],
  };
  let { data, error } = await supabase
    .from("agent_thread_messages")
    .insert({
      ...baseRow,
      parent_message_id: userMessageId,
      tokens_in: stamped.tokensIn,
      tokens_out: stamped.tokensOut,
      model: stamped.model,
      cost_usd: stamped.costUsd,
      saved_vs_default_usd: stamped.savedVsDefaultUsd,
      default_model: DEFAULT_MODEL,
    })
    .select("id")
    .single();

  if (
    error &&
    /parent_message_id|cost_usd|saved_vs_default_usd|default_model|tokens_in|tokens_out|model/.test(
      error.message,
    )
  ) {
    // Server DB hasn't been fully migrated yet — retry with legacy-safe columns.
    const retry = await supabase
      .from("agent_thread_messages")
      .insert(baseRow)
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.warn("[agents.chat] Assistant message insert failed:", error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

/**
 * Founder-agent message endpoints on the Brain.
 *
 * Each Brain route has its own request contract:
 *   /sherlock/audit  -> { content }   (real 3x audit loop, DeepSeek R1)
 *   /sherlock/stream -> { messages }  (SSE)
 *   orchestrate      -> { message }   (compat)
 * `brainChatBody()` sends all three shapes so every candidate route validates.
 */
function brainChatPaths(slug: string, opts?: { stream?: boolean }) {
  if (slug === "sherlock") {
    return opts?.stream
      ? [
          "/api/founder/sherlock/stream",
          "/api/founder/sherlock/audit",
          "/api/founder/sherlock/orchestrate",
        ]
      : [
          "/api/founder/sherlock/audit",
          "/api/founder/sherlock/stream",
          "/api/founder/sherlock/orchestrate",
        ];
  }
  return [
    "/api/founder/jimmy/stream",
    `/api/agents/${slug}/chat`,
  ];
}

/**
 * Superset request body accepted by every Brain founder route.
 * Missing any of `content` / `messages` / `message` makes one of them 400.
 */
function brainChatBody(
  slug: string,
  prompt: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const instructions = founderCommunicationContract(slug);
  const contractedPrompt = brainPrompt(slug, prompt);
  return {
    agent: slug,
    slug,
    message: contractedPrompt,
    prompt: contractedPrompt,
    content: contractedPrompt,
    system: instructions,
    systemPrompt: instructions,
    instructions,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: prompt },
    ],
    disabledProviders: DISABLED_PROVIDER_IDS,
    excludeProviderIds: DISABLED_PROVIDER_IDS,
    skipProviderIds: DISABLED_PROVIDER_IDS,
    ...extra,
  };
}


async function runBrainAndInsert(job: BrainJob) {
  const { supabase, slug, prompt, threadId, userMessageId, brainURLs, signal } = job;
  let assistantText = "";
  let rustPayload: unknown = null;
  let rustError: string | null = null;
  let meta: CompletionMeta | undefined;

  const chatPaths = brainChatPaths(slug);
  outer: for (const brainURL of brainURLs) {
    for (const path of chatPaths) {
      const ctrl = new AbortController();
      const abort = () => ctrl.abort(signal?.reason);
      if (signal?.aborted) ctrl.abort(signal.reason);
      else signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => ctrl.abort(), BRAIN_ATTEMPT_TIMEOUT_MS);
      try {
        const r = await fetch(`${brainURL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(brainChatBody(slug, prompt)),
          signal: ctrl.signal,
        });
        if (!r.ok) {
          rustError = `Brain ${brainURL}${path} ${r.status}: ${await r.text().catch(() => "")}`.slice(
            0,
            500,
          );
          // 404/405 = wrong path on this brain, try the next candidate path
          if (r.status !== 404 && r.status !== 405) {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            break;
          }
        } else {
          rustPayload = await r.json().catch(() => null);
          assistantText = extractText(rustPayload);
          meta = { model: extractModel(rustPayload), ...extractUsage(rustPayload) };
          rustError = null;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          break outer;
        }
      } catch (err) {
        rustError =
          err instanceof Error && err.name === "AbortError"
            ? `Brain response timeout: ${brainURL}`
            : err instanceof Error
              ? `${brainURL}: ${err.message}`
              : `${brainURL}: ${String(err)}`;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }

      if (signal?.aborted) break outer;
    }
    if (signal?.aborted || assistantText) break;
  }


  if (signal?.aborted) return;

  if (hasProviderKeyFailure(rustError ?? assistantText) || violatesFounderVoice(assistantText)) {
    const direct = await runDirectFallback(slug, prompt, signal);
    if (direct && "text" in direct && direct.text) {
      assistantText = direct.text;
      rustError = null;
      meta = { model: direct.model, tokensIn: direct.tokensIn, tokensOut: direct.tokensOut };
    } else if (direct && "error" in direct && direct.error) {
      rustError = `Direct fallback failed: ${direct.error}`;
      assistantText = "";
    }
  }

  if (rustError && !assistantText) {
    if (isBackgroundSherlockAudit(slug, prompt)) {
      console.warn("[agents.chat] Background Sherlock audit skipped:", rustError);
      return;
    }
    assistantText = `⚠️ Brain unreachable: ${rustError}`;
  }

  const looped = await safeRunCoreBuilderLoop(job, assistantText, meta);
  await insertAssistantMessage(job, looped.text, looped.meta);
}

function streamBrainToClient(job: BrainJob) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => controller.enqueue(sseFrame(event, data));
        send("ack", {
          threadId: job.threadId,
          userMessageId: job.userMessageId,
          status: "streaming",
        });

        let assistantText = "";
        let rustError: string | null = null;
        const ctrl = new AbortController();
        let abortedByFounder = false;
        const abort = () => {
          abortedByFounder = true;
          ctrl.abort(job.signal?.reason);
        };
        if (job.signal?.aborted) abort();
        else job.signal?.addEventListener("abort", abort, { once: true });
        const timer = setTimeout(() => ctrl.abort(), RUST_TIMEOUT_MS);
        let meta: CompletionMeta | undefined;

        try {
          let r: Response | null = null;
          for (const brainURL of job.brainURLs) {
            for (const path of brainChatPaths(job.slug, { stream: true })) {
              try {
                r = await fetch(`${brainURL}${path}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
                  body: JSON.stringify(brainChatBody(job.slug, job.prompt, { stream: true })),
                  signal: ctrl.signal,
                });
                if (r.ok) break;
                rustError =
                  `Brain ${brainURL}${path} ${r.status}: ${await r.text().catch(() => "")}`.slice(
                    0,
                    500,
                  );
                const retryable = r.status === 404 || r.status === 405;
                r = null;
                if (!retryable) break;
              } catch (err) {
                rustError =
                  err instanceof Error && err.name === "AbortError"
                    ? `Brain response timeout: ${brainURL}`
                    : err instanceof Error
                      ? `${brainURL}: ${err.message}`
                      : `${brainURL}: ${String(err)}`;
                r = null;
              }
              if (job.signal?.aborted) break;
            }
            if (r?.ok || job.signal?.aborted) break;
          }


          if (!r) {
            throw new Error(rustError ?? "Brain unavailable");
          }

          /* const r = await fetch(`${job.brainURL}/api/agents/${job.slug}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
            body: JSON.stringify({
              message: job.prompt,
              stream: true,
              disabledProviders: DISABLED_PROVIDER_IDS,
              excludeProviderIds: DISABLED_PROVIDER_IDS,
              skipProviderIds: DISABLED_PROVIDER_IDS,
            }),
            signal: ctrl.signal,
          }); */
          if (!r.ok) {
            rustError = `Rust ${r.status}: ${await r.text().catch(() => "")}`.slice(0, 500);
          } else if (r.headers.get("content-type")?.includes("text/event-stream") && r.body) {
            const reader = r.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const frames = buffer.split(/\r?\n\r?\n/);
              buffer = frames.pop() ?? "";
              for (const frame of frames) {
                const data = frame
                  .split(/\r?\n/)
                  .filter((line) => line.startsWith("data:"))
                  .map((line) => line.slice(5).trimStart())
                  .join("\n");
                if (!data || data === "[DONE]") continue;
                let payload: unknown = data;
                try {
                  payload = JSON.parse(data);
                } catch {
                  /* plain token */
                }
                const payloadModel = extractModel(payload);
                const payloadUsage = extractUsage(payload);
                if (payloadModel || payloadUsage.tokensIn || payloadUsage.tokensOut) {
                  meta = {
                    model: payloadModel ?? meta?.model,
                    tokensIn: payloadUsage.tokensIn ?? meta?.tokensIn,
                    tokensOut: payloadUsage.tokensOut ?? meta?.tokensOut,
                  };
                }
                const delta = extractDelta(payload);
                if (delta) {
                  if (hasProviderKeyFailure(delta)) {
                    assistantText = delta;
                    rustError = delta;
                    continue;
                  }
                  assistantText += delta;
                }
                const finalText = extractText(payload);
                if (!delta && finalText && /done|final|complete/i.test(frame)) {
                  assistantText = finalText;
                }
              }
            }
          } else {
            const contentType = r.headers.get("content-type") ?? "";
            const payload = contentType.includes("application/json")
              ? await r.json().catch(() => null)
              : await r.text().catch(() => "");
            assistantText = extractText(payload);
            meta = { model: extractModel(payload), ...extractUsage(payload) };
          }
        } catch (err) {
          rustError =
            err instanceof Error && err.name === "AbortError"
              ? "Brain response timeout"
              : err instanceof Error
                ? err.message
                : String(err);
        } finally {
          clearTimeout(timer);
          job.signal?.removeEventListener("abort", abort);
        }

        if (abortedByFounder || job.signal?.aborted) {
          try {
            controller.close();
          } catch {
            /* client already gone */
          }
          return;
        }

        if (hasProviderKeyFailure(rustError ?? assistantText) || violatesFounderVoice(assistantText)) {
          const direct = await runDirectFallback(job.slug, job.prompt, job.signal);
          if (direct && "text" in direct && direct.text) {
            assistantText = direct.text;
            rustError = null;
            meta = { model: direct.model, tokensIn: direct.tokensIn, tokensOut: direct.tokensOut };
            send("token", { delta: direct.text });
          } else if (direct && "error" in direct && direct.error) {
            rustError = `Direct fallback failed: ${direct.error}`;
            assistantText = "";
          }
        }

        if (rustError && !assistantText) {
          if (isBackgroundSherlockAudit(job.slug, job.prompt)) {
            console.warn("[agents.chat] Background Sherlock audit skipped:", rustError);
            send("done", {
              threadId: job.threadId,
              userMessageId: job.userMessageId,
              status: "done",
            });
            controller.close();
            return;
          }
          assistantText = `⚠️ Brain unreachable: ${rustError}`;
          send("error", { error: rustError });
        }

        let finalText = assistantText;
        let finalMeta = meta;
        if (assistantText) {
          const looped = await safeRunCoreBuilderLoop(job, assistantText, meta);
          finalText = looped.text;
          finalMeta = looped.meta;
          send("token", { delta: finalText });
        }
        const assistantMessageId = finalText
          ? await insertAssistantMessage(job, finalText, finalMeta)
          : null;
        send("done", {
          threadId: job.threadId,
          userMessageId: job.userMessageId,
          assistantMessageId,
          assistantText: finalText,
          status: "done",
        });
        controller.close();
      },
    }),
    { status: 200, headers: SSE_HEADERS },
  );
}

export const Route = createFileRoute("/api/agents/$slug/chat")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const slug = params.slug;
        if (!ALLOWED_SLUGS.has(slug)) {
          return Response.json({ error: `Agent slug not allowed: ${slug}` }, { status: 400 });
        }

        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const projectId = body.projectId?.trim();
        const prompt = body.prompt?.trim();
        if (!projectId || !prompt) {
          return Response.json({ error: "projectId and prompt are required" }, { status: 400 });
        }

        const SB_URL = process.env.SUPABASE3_URL;
        const SB_KEY = process.env.SUPABASE3_SERVICE_ROLE_KEY;
        if (!SB_URL || !SB_KEY) {
          return Response.json(
            { error: "Supabase 3 not configured on builder server" },
            { status: 500 },
          );
        }

        const supabase = createClient(SB_URL, SB_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Resolve founder user_id from forwarded bearer token or GitHub founder session.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        let userId = "";
        if (token) {
          const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
          if (userErr || !userRes?.user) {
            return Response.json(
              { error: `Invalid session: ${userErr?.message ?? "no user"}` },
              { status: 401 },
            );
          }
          userId = userRes.user.id;
        } else {
          const { readFounderSession, resolveFounderUserId } =
            await import("@/lib/founder-session.server");
          const founderSession = readFounderSession(request);
          if (founderSession) {
            userId = await resolveFounderUserId(supabase, founderSession);
          } else {
            // Preview-host bypass — mirrors _authenticated/route.tsx.
            // Prod (aiaxonetis.nexatect.com) still enforces GitHub session.
            const host = new URL(request.url).hostname;
            const isPreview =
              host === "localhost" ||
              host === "127.0.0.1" ||
              host.endsWith(".lovableproject.com") ||
              host.endsWith(".lovable.dev") ||
              host.endsWith(".lovable.app") ||
              host.includes("id-preview--") ||
              host.startsWith("preview--") ||
              host === "founderbuilder.axonetis.com" ||
              host.endsWith(".axonetis.com");
            if (!isPreview) {
              return Response.json(
                { error: "Founder GitHub session required. Login at /auth first." },
                { status: 401 },
              );
            }
            // Synthesize a preview-only founder session (allowlist-free, host-gated).
            userId = await resolveFounderUserId(supabase, {
              sub: "preview",
              login: "preview",
              githubId: 0,
              name: "Preview Founder",
              iat: 0,
              exp: 0,
            });
          }
        }

        // 1. Ensure thread
        let threadId = body.threadId?.trim() || null;
        if (!threadId) {
          const { data: t, error: tErr } = await supabase
            .from("agent_threads")
            .insert({
              project_id: projectId,
              agent_slug: slug,
              title: prompt.slice(0, 80),
              user_id: userId,
            })
            .select("id")
            .single();
          if (tErr || !t) {
            return Response.json(
              { error: `Failed to create thread: ${tErr?.message ?? "unknown"}` },
              { status: 500 },
            );
          }
          threadId = t.id as string;
        }

        // 2. Insert user message
        const { data: userMsg, error: uErr } = await supabase
          .from("agent_thread_messages")
          .insert({
            thread_id: threadId,
            role: "user",
            agent_slug: slug,
            parts: [{ type: "text", text: prompt }],
          })
          .select("id")
          .single();
        if (uErr || !userMsg) {
          return Response.json(
            { error: `Failed to insert user message: ${uErr?.message ?? "unknown"}` },
            { status: 500 },
          );
        }

        // 3. Kick Rust ensemble in background. Do NOT hold the UI hostage.
        const brainURLs = resolveBrainURLs();
        const wantsSse =
          body.stream === true || request.headers.get("accept")?.includes("text/event-stream");
        if (wantsSse) {
          return streamBrainToClient({
            supabase,
            slug,
            prompt,
            projectId,
            threadId,
            userMessageId: userMsg.id as string,
            userId,
            brainURLs,
            signal: request.signal,
          });
        }
        const job = runBrainAndInsert({
          supabase,
          slug,
          prompt,
          projectId,
          threadId,
          userMessageId: userMsg.id as string,
          userId,
          brainURLs,
        });
        job.catch((err) => console.warn("[agents.chat] Brain job failed:", err));

        return Response.json(
          {
            threadId,
            userMessageId: userMsg.id,
            status: "queued",
          },
          { status: 200 },
        );
      },
    },
  },
});
