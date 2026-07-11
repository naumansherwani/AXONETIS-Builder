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
const BRAIN_MAX_OUTPUT_TOKENS = 8_192;

type ChatBody = {
  projectId?: string;
  threadId?: string | null;
  prompt?: string;
  streamId?: string;
};

type BrainJob = {
  supabase: SupabaseClient;
  slug: string;
  prompt: string;
  threadId: string;
  userMessageId: string;
  brainURL: string;
};

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

async function runBrainAndInsert({ supabase, slug, prompt, threadId, userMessageId, brainURL }: BrainJob) {
  let assistantText = "";
  let rustPayload: unknown = null;
  let rustError: string | null = null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RUST_TIMEOUT_MS);
  try {
    const r = await fetch(`${brainURL}/api/agents/${slug}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        stream: true,
        generationConfig: {
          maxOutputTokens: BRAIN_MAX_OUTPUT_TOKENS,
          temperature: 0.35,
        },
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      rustError = `Rust ${r.status}: ${await r.text().catch(() => "")}`.slice(0, 500);
    } else {
      rustPayload = await r.json().catch(() => null);
      assistantText = extractText(rustPayload);
    }
  } catch (err) {
    rustError = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }

  if (rustError && !assistantText) {
    assistantText = `⚠️ Brain unreachable: ${rustError}`;
  }

  const { error: aErr } = await supabase
    .from("agent_thread_messages")
    .insert({
      thread_id: threadId,
      role: "agent",
      agent_slug: slug,
      parent_message_id: userMessageId,
      parts: [{ type: "text", text: assistantText }],
    });

  if (aErr) {
    console.warn("[agents.chat] Assistant message insert failed:", aErr.message);
  }
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
