/**
 * Phase 3.10.3-B — Diff decision endpoint (builder side, single source of truth).
 *
 * Frontend contract (src/lib/diff-api.ts):
 *   POST /api/agents/diff/decision  { diff_id, decision }
 *   POST /api/agents/diff/decision  { diff_ids: string[], decision }
 *   decision = "approve" | "reject"
 *
 * Flow:
 *   1. Validate body.
 *   2. Update `agent_diffs` rows in Supabase 3 (status + decided_at).
 *   3. On approve → forward to hostflow-server bridge `POST /rpc/diff.apply`
 *      which performs the real file write + git commit (see
 *      server-snippets/diff.routes.ts). Never applies code from the browser.
 *
 * Env on Hetzner (pm2 axonetis-builder):
 *   SUPABASE3_URL, SUPABASE3_SERVICE_ROLE_KEY
 *   HOSTFLOW_SERVER_URL (default http://127.0.0.1:8090)
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Decision = "approve" | "reject";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/agents/diff/decision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ ok: false, error: "invalid json" }, 400);
        }

        const decision = body["decision"];
        if (decision !== "approve" && decision !== "reject") {
          return json({ ok: false, error: "decision must be approve|reject" }, 400);
        }
        const ids: string[] = Array.isArray(body["diff_ids"])
          ? (body["diff_ids"] as unknown[]).filter((v): v is string => typeof v === "string")
          : typeof body["diff_id"] === "string"
            ? [body["diff_id"] as string]
            : [];
        if (ids.length === 0) return json({ ok: false, error: "diff_id required" }, 400);

        const url = process.env["SUPABASE3_URL"];
        const key = process.env["SUPABASE3_SERVICE_ROLE_KEY"];
        if (!url || !key) {
          return json({ ok: false, error: "Supabase 3 not configured on server" }, 503);
        }
        const supabase = createClient(url, key, { auth: { persistSession: false } });

        const status = decision === "approve" ? "approved" : "rejected";


        const { error } = await supabase
          .from("agent_diffs")
          .update({ status, decided_at: new Date().toISOString() })
          .in("id", ids);
        if (error) return json({ ok: false, error: error.message }, 500);

        let applied: unknown = null;
        if (decision === "approve") {
          const bridge = (process.env["HOSTFLOW_SERVER_URL"] ?? "http://127.0.0.1:8090").replace(
            /\/$/,
            "",
          );
          try {
            const res = await fetch(`${bridge}/rpc/diff.apply`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ diff_ids: ids }),
            });
            applied = res.ok ? await res.json() : { ok: false, status: res.status };
          } catch (err) {
            applied = { ok: false, error: err instanceof Error ? err.message : String(err) };
          }
        }

        return json({ ok: true, decision, count: ids.length, applied });
      },
    },
  },
});
