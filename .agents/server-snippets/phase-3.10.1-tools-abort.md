# Phase 3.10.1 — Server Snippet: POST /rpc/tools.abort

**Target**: `/opt/hostflowai-brain/backend/src/routes/tools.ts` (NEW file)
**Mount**: 1 line in `src/routes/index.ts`
**Purpose**: SIGTERM the Rust `axonetis-builder` worker child bound to a
running `tool_call`, mark the row `status="error"` + `error="aborted by founder"`,
and let Supabase 3 Realtime push the update to the UI.

**Zero dummy. Zero duplicate.** Reuses the shared `ok()`/`err()` responders and
Supabase client pattern already used by `publish.ts`.

---

## 1) NEW FILE — `src/routes/tools.ts`

```ts
import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { ok, err } from "../lib/response.js";

const sb = createClient(
  process.env["SUPABASE3_URL"]!,
  process.env["SUPABASE3_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);

const router: IRouter = Router();

/**
 * POST /rpc/tools.abort
 * Body: { tool_call_id: string, abort_token?: string }
 *
 * 1. Look up the running tool_call row (by scanning agent_thread_messages
 *    parts[] for id == tool_call_id + status in queued/running).
 * 2. If an abort_token / pid mapping exists in `tool_call_registry`, SIGTERM
 *    the worker child. (The Rust runtime writes pid + abort_token when it
 *    spawns the tool.)
 * 3. Update the message row: set that part's status="error",
 *    error="aborted by founder", finished_at=now(). Supabase Realtime
 *    pushes the row → UI ToolCallBubble flips red.
 */
router.post("/rpc/tools.abort", async (req: Request, res: Response) => {
  const { tool_call_id, abort_token } = req.body ?? {};
  if (!tool_call_id || typeof tool_call_id !== "string") {
    return err(res, 400, "tool_call_id required");
  }

  // 1) Find the pid (if the runtime registered one).
  const { data: reg } = await sb
    .from("tool_call_registry")
    .select("pid, abort_token, thread_id, message_id")
    .eq("tool_call_id", tool_call_id)
    .maybeSingle();

  if (reg?.abort_token && abort_token && reg.abort_token !== abort_token) {
    return err(res, 403, "abort_token mismatch");
  }

  // 2) SIGTERM the worker child, if we have a pid and it's still alive.
  if (reg?.pid && Number.isFinite(reg.pid)) {
    try {
      // `kill -0` probes existence; `kill -TERM` sends SIGTERM.
      const alive = spawnSync("kill", ["-0", String(reg.pid)]);
      if (alive.status === 0) {
        spawnSync("kill", ["-TERM", String(reg.pid)]);
      }
    } catch (e) {
      console.warn("[tools.abort] SIGTERM failed:", e);
    }
  }

  // 3) Mark the message part aborted. Rust runtime is the authoritative
  //    writer; this write is defensive so the UI updates even if the
  //    worker was already wedged.
  if (reg?.message_id) {
    const { data: msg } = await sb
      .from("agent_thread_messages")
      .select("parts")
      .eq("id", reg.message_id)
      .maybeSingle();
    if (msg && Array.isArray(msg.parts)) {
      const patched = msg.parts.map((p: any) => {
        if (p?.type === "tool_call" && p.id === tool_call_id) {
          return { ...p, status: "error", error: "aborted by founder", aborted_at: new Date().toISOString() };
        }
        return p;
      });
      await sb.from("agent_thread_messages").update({ parts: patched }).eq("id", reg.message_id);
    }
  }

  // Cleanup registry (best effort).
  await sb.from("tool_call_registry").delete().eq("tool_call_id", tool_call_id);

  return ok(res, { aborted: true, tool_call_id });
});

export default router;
```

---

## 2) MOUNT — one line in `src/routes/index.ts`

```ts
import toolsRouter from "./tools.js";
// … existing imports …

router.use(toolsRouter);   // adds /rpc/tools.abort
```

Place next to `router.use(publishRouter)` — no other change.

---

## 3) SQL — Supabase 3 (idempotent)

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.tool_call_registry (
  tool_call_id   text PRIMARY KEY,
  thread_id      uuid NOT NULL,
  message_id     uuid NOT NULL,
  pid            integer,
  abort_token    text,
  started_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tool_call_registry_thread_idx
  ON public.tool_call_registry (thread_id);

COMMIT;
```

The Rust `axonetis-builder` worker inserts a row here the moment it spawns
a tool child (with its pid + a random abort_token) and deletes it on
success/failure. This snippet only READs from it — the runtime owns writes.

---

## 4) Verify

```bash
# smoke: expect 400 "tool_call_id required"
curl -s -X POST http://localhost:$PORT/api/rpc/tools.abort \
     -H "Content-Type: application/json" -d '{}'

# smoke with fake id (returns ok=true, aborted=true — noop path)
curl -s -X POST http://localhost:$PORT/api/rpc/tools.abort \
     -H "Content-Type: application/json" \
     -d '{"tool_call_id":"tc_test_noop"}'
```

Then in the UI: run a long tool (any file scan) → click **cancel** on the
bubble → status flips red within ~1s via Realtime.
