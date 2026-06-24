/**
 * Phase A.1 — Builder-side proxy route for Jimmy/Sherlock/Advisor chat.
 *
 * Split (3-process-split-LOCKED Option B):
 *   - This repo = UI + thin proxy ONLY (no LLM SDK calls here).
 *   - Rust NEXATECT-Engine :8088 = brain (Jimmy/Sherlock ensembles).
 *   - hostflow-server = files/projects/deploy bridge.
 *
 * Flow:
 *   1. Client POSTs { projectId, threadId?, prompt } to /api/agents/<slug>/chat
 *   2. We ensure a thread exists, insert user message into Supabase 3
 *      `agent_thread_messages` (service role).
 *   3. Fire-and-forget POST to Rust `:8088/chat/<slug>` with { threadId,
 *      projectId, prompt }. Rust writes the assistant reply back into the
 *      same Supabase 3 table; UnifiedChat picks it up via Realtime.
 *   4. Return 202 { threadId, messageId, status: "queued" } immediately.
 *
 * Env required on Hetzner (pm2 axonetis-builder):
 *   SUPABASE3_URL, SUPABASE3_SERVICE_ROLE_KEY
 *   RUST_BRAIN_URL (default http://127.0.0.1:8088)
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_SLUGS = new Set(["jimmy", "sherlock"]);

type ChatBody = {
  projectId?: string;
  threadId?: string | null;
  prompt?: string;
};

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

        // 1. Ensure thread
        let threadId = body.threadId?.trim() || null;
        if (!threadId) {
          const { data: t, error: tErr } = await supabase
            .from("agent_threads")
            .insert({ project_id: projectId, agent_slug: slug, title: prompt.slice(0, 80) })
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
        const { data: msg, error: mErr } = await supabase
          .from("agent_thread_messages")
          .insert({
            thread_id: threadId,
            role: "user",
            agent_slug: slug,
            parts: [{ type: "text", text: prompt }],
          })
          .select("id")
          .single();
        if (mErr || !msg) {
          return Response.json(
            { error: `Failed to insert message: ${mErr?.message ?? "unknown"}` },
            { status: 500 },
          );
        }

        // 3. Fire-and-forget to Rust brain (Rust writes the assistant reply
        //    back into agent_thread_messages — Realtime delivers it to UI).
        const brainURL = process.env.RUST_BRAIN_URL ?? "http://127.0.0.1:8088";
        void fetch(`${brainURL.replace(/\/$/, "")}/chat/${slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            projectId,
            messageId: msg.id,
            prompt,
          }),
        }).catch((err) => {
          console.error(`[agents.chat] Rust brain forward failed:`, err);
        });

        return Response.json(
          { threadId, messageId: msg.id, status: "queued" as const },
          { status: 202 },
        );
      },
    },
  },
});
