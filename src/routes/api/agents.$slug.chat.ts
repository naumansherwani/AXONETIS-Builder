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

const ALLOWED_SLUGS = new Set(["jimmy", "sherlock"]);
const RUST_TIMEOUT_MS = 45_000;
const DIRECT_FALLBACK_TIMEOUT_MS = 30_000;
const DISABLED_PROVIDER_IDS = ["J-bk-deepseek-v31-fr", "S-bk-llama-70b-fr"];
const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "qwen/qwen-2.5-coder-32b": { in: 0.18, out: 0.18 },
  "qwen/qwen-2.5-coder-32b-instruct": { in: 0.18, out: 0.18 },
  "qwen/qwen3-32b": { in: 0.18, out: 0.18 },
  "meta-llama/llama-3.3-70b-instruct": { in: 0.23, out: 0.40 },
  "deepseek/deepseek-r1": { in: 0.55, out: 2.19 },
  "deepseek/deepseek-r1:free": { in: 0, out: 0 },
  "deepseek/deepseek-chat-v3.1:free": { in: 0, out: 0 },
  "anthropic/claude-3.5-sonnet": { in: 3, out: 15 },
  "openai/gpt-4o-mini": { in: 0.15, out: 0.60 },
  "openai/gpt-oss-120b": { in: 0.15, out: 0.60 },
  "llama-3.3-70b-versatile": { in: 0.23, out: 0.40 },
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
  threadId: string;
  userMessageId: string;
  brainURL: string;
  signal?: AbortSignal;
};

type CompletionMeta = {
  model?: string | null;
  tokensIn?: number;
  tokensOut?: number;
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
  return MODEL_PRICING[normalized] ?? MODEL_PRICING[normalized.replace(/:free$/i, "")] ?? { in: 0.6, out: 2.4 };
}

function completionMeta(prompt: string, assistantText: string, meta?: CompletionMeta) {
  const model = normalizeModelLabel(meta?.model);
  const tokensIn = meta?.tokensIn && meta.tokensIn > 0 ? meta.tokensIn : estimateTokenCount(prompt);
  const tokensOut = meta?.tokensOut && meta.tokensOut > 0 ? meta.tokensOut : estimateTokenCount(assistantText);
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
    return "You are SherlockReview, AXONETIS AI Builder's strict audit/debug agent. Reply in concise Roman Urdu/Hindi when the founder writes that way. Be practical, identify root cause, and never invent fake backend results.";
  }
  return "You are JimmyBuild Agent for AXONETIS AI Builder. Reply in concise Roman Urdu/Hindi when the founder writes that way. Help build real production features, explain exact next actions, and never pretend a backend action happened if it did not.";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, parentSignal?: AbortSignal) {
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
  const key = providerEnv("GROQ_API_KEY", "GROQ_KEY", "NEXATECT_GROQ_API_KEY", "HOSTFLOW_GROQ_API_KEY");
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
      const r = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
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
      }, DIRECT_FALLBACK_TIMEOUT_MS, signal);
      if (!r.ok) {
        lastError = `${model}: ${r.status} ${await r.text().catch(() => "")}`.slice(0, 280);
        continue;
      }
      const payload = await r.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number } } | null;
      const text = payload?.choices?.[0]?.message?.content?.trim();
      if (text) return {
        text,
        model: `groq:${model}`,
        tokensIn: payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens,
        tokensOut: payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens,
      };
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 280);
    }
  }
  return lastError ? { error: lastError } : null;
}

async function callOpenRouterFallback(slug: string, prompt: string, signal?: AbortSignal) {
  const key = providerEnv("OPENROUTER_API_KEY", "OPENROUTER_KEY", "NEXATECT_OPENROUTER_API_KEY", "HOSTFLOW_OPENROUTER_API_KEY");
  if (!key) return null;

  const models = modelsFromEnv(
    slug === "sherlock" ? "AXONETIS_SHERLOCK_OPENROUTER_MODELS" : "AXONETIS_JIMMY_OPENROUTER_MODELS",
    slug === "sherlock"
      ? ["deepseek/deepseek-r1:free", "meta-llama/llama-3.3-70b-instruct:free", "qwen/qwen-2.5-coder-32b-instruct"]
      : ["qwen/qwen-2.5-coder-32b-instruct", "deepseek/deepseek-chat-v3.1:free", "meta-llama/llama-3.3-70b-instruct:free"],
  );

  let lastError = "";
  for (const model of models) {
    try {
      const r = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
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
      }, DIRECT_FALLBACK_TIMEOUT_MS, signal);
      if (!r.ok) {
        lastError = `${model}: ${r.status} ${await r.text().catch(() => "")}`.slice(0, 280);
        continue;
      }
      const payload = await r.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number } } | null;
      const text = payload?.choices?.[0]?.message?.content?.trim();
      if (text) return {
        text,
        model: `openrouter:${model}`,
        tokensIn: payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens,
        tokensOut: payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens,
      };
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 280);
    }
  }
  return lastError ? { error: lastError } : null;
}

async function runDirectFallback(slug: string, prompt: string, signal?: AbortSignal) {
  const primary = slug === "sherlock"
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
  return JSON.stringify(payload, null, 2);
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
  const usage = (p.usage ?? (p.best as Record<string, unknown> | undefined)?.usage) as Record<string, unknown> | undefined;
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
    (p.choices as Array<{ delta?: { content?: string }; text?: string }> | undefined)?.[0]?.delta?.content,
    (p.choices as Array<{ delta?: { content?: string }; text?: string }> | undefined)?.[0]?.text,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c) return c;
  }
  return "";
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

  if (error && /parent_message_id|cost_usd|saved_vs_default_usd|default_model|tokens_in|tokens_out|model/.test(error.message)) {
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

async function runBrainAndInsert(job: BrainJob) {
  const { supabase, slug, prompt, threadId, userMessageId, brainURL, signal } = job;
  let assistantText = "";
  let rustPayload: unknown = null;
  let rustError: string | null = null;
  let meta: CompletionMeta | undefined;

  const ctrl = new AbortController();
  const abort = () => ctrl.abort(signal?.reason);
  if (signal?.aborted) ctrl.abort(signal.reason);
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), RUST_TIMEOUT_MS);
  try {
    const r = await fetch(`${brainURL}/api/agents/${slug}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        disabledProviders: DISABLED_PROVIDER_IDS,
        excludeProviderIds: DISABLED_PROVIDER_IDS,
        skipProviderIds: DISABLED_PROVIDER_IDS,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      rustError = `Rust ${r.status}: ${await r.text().catch(() => "")}`.slice(0, 500);
    } else {
      rustPayload = await r.json().catch(() => null);
      assistantText = extractText(rustPayload);
      meta = { model: extractModel(rustPayload), ...extractUsage(rustPayload) };
    }
  } catch (err) {
    rustError = err instanceof Error && err.name === "AbortError"
      ? "Brain response timeout"
      : err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }

  if (signal?.aborted) return;

  if (hasProviderKeyFailure(rustError ?? assistantText)) {
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

  await insertAssistantMessage(job, assistantText, meta);
}

function streamBrainToClient(job: BrainJob) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => controller.enqueue(sseFrame(event, data));
        send("ack", { threadId: job.threadId, userMessageId: job.userMessageId, status: "streaming" });

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
          const r = await fetch(`${job.brainURL}/api/agents/${job.slug}/chat`, {
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
          });
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
                try { payload = JSON.parse(data); } catch { /* plain token */ }
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
                  send("token", { delta });
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
            if (assistantText && !hasProviderKeyFailure(assistantText)) send("token", { delta: assistantText });
          }
        } catch (err) {
          rustError = err instanceof Error && err.name === "AbortError"
            ? "Brain response timeout"
            : err instanceof Error ? err.message : String(err);
        } finally {
          clearTimeout(timer);
          job.signal?.removeEventListener("abort", abort);
        }

        if (abortedByFounder || job.signal?.aborted) {
          try { controller.close(); } catch { /* client already gone */ }
          return;
        }

        if (hasProviderKeyFailure(rustError ?? assistantText)) {
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
            send("done", { threadId: job.threadId, userMessageId: job.userMessageId, status: "done" });
            controller.close();
            return;
          }
          assistantText = `⚠️ Brain unreachable: ${rustError}`;
          send("error", { error: rustError });
        }

        const assistantMessageId = assistantText ? await insertAssistantMessage(job, assistantText, meta) : null;
        send("done", {
          threadId: job.threadId,
          userMessageId: job.userMessageId,
          assistantMessageId,
          assistantText,
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
          return Response.json(
            { error: `Agent slug not allowed: ${slug}` },
            { status: 400 },
          );
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
          return Response.json(
            { error: "projectId and prompt are required" },
            { status: 400 },
          );
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
          const { readFounderSession, resolveFounderUserId } = await import("@/lib/founder-session.server");
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
              host.startsWith("preview--");
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
        const brainURL = (process.env.RUST_BRAIN_URL ?? "http://127.0.0.1:8088").replace(/\/$/, "");
        const wantsSse = body.stream === true || request.headers.get("accept")?.includes("text/event-stream");
        if (wantsSse) {
          return streamBrainToClient({
            supabase,
            slug,
            prompt,
            threadId,
            userMessageId: userMsg.id as string,
            brainURL,
            signal: request.signal,
          });
        }
        const job = runBrainAndInsert({
          supabase,
          slug,
          prompt,
          threadId,
          userMessageId: userMsg.id as string,
          brainURL,
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
