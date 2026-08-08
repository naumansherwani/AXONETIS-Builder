/**
 * AXONETIS Phase 3.10.9 — agents.routes v2 TOOL REGISTRY (12/12, full server implementation)
 *
 * COPY-PASTE TARGET (Hetzner, bridge repo — VERIFIED PATH):
 *   /opt/hostflow-ecosystem/hostflow-server/src/routes/agents.tools.ts
 *
 * WHY OLD-GEN (Express + AI SDK, no tRPC/WebTransport):
 *   Phase 3.10.x is FROZEN old-gen per constraints/additive-only-tech-policy-LOCKED.
 *   3.10.9 finishes an EXISTING phase → it MUST stay on Bun + TypeScript + AI SDK
 *   + Express `/rpc` + SSE. tRPC/WebTransport start at Phase 3.11 (new files only).
 *
 * ZERO DUPLICATE: this file only exports the 12 tools + logging helpers.
 * `agents.worker.ts` imports `buildAgentTools()` and passes it to streamText.
 * No route mounting here, no second Supabase client factory in the worker.
 *
 * LOCKED tool set (blueprint §Phase 3.10):
 *   1 write_file          7 run_tests
 *   2 read_file           8 screenshot_preview
 *   3 line_replace        9 fetch_url
 *   4 grep               10 git_commit
 *   5 run_sql   (approve)11 deploy            (approve)
 *   6 lsp_lookup         12 spawn_subagent    (max 5)
 *
 * Every call writes a `tool_call_registry` row (running → ok/error/aborted) so the
 * Builder UI's ToolCallBubble + ActivityFeedPanel light up over Supabase 3 Realtime.
 *
 * Required env:
 *   SUPABASE3_URL, SUPABASE3_SERVICE_ROLE_KEY
 *   PROJECTS_ROOT (default /opt/axonetis-projects)
 *   DATABASE_URL            — run_sql
 *   PREVIEW_BASE_URL        — screenshot_preview (default http://127.0.0.1:8091)
 *   BRIDGE_SELF_URL         — deploy / spawn_subagent self-calls (default http://127.0.0.1:8090)
 */

import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

const PROJECTS_ROOT = process.env.PROJECTS_ROOT || "/opt/axonetis-projects";
const PREVIEW_BASE_URL = process.env.PREVIEW_BASE_URL || "http://127.0.0.1:8091";
const BRIDGE_SELF_URL = process.env.BRIDGE_SELF_URL || "http://127.0.0.1:8090";
const MAX_SUBAGENTS = 5;

const sb3: SupabaseClient = createClient(
  process.env.SUPABASE3_URL!,
  process.env.SUPABASE3_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws as never } },
);

export interface ToolCtx {
  threadId: string;
  messageId: string;
  projectId: string; // slug or uuid
  projectUuid: string;
  agentSlug: string;
  userId?: string;
  isFounder?: boolean;
  abortSignal?: AbortSignal;
}

/* ────────────────────────── shared helpers ────────────────────────── */

function projectDir(ctx: ToolCtx) {
  return path.join(PROJECTS_ROOT, ctx.projectId);
}

/** Refuse traversal + dotfile escapes. Returns absolute path inside project dir. */
function safePath(ctx: ToolCtx, rel: string) {
  const clean = rel.replace(/^\/+/, "");
  const abs = path.resolve(projectDir(ctx), clean);
  const root = path.resolve(projectDir(ctx));
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`path escapes project root: ${rel}`);
  }
  return { abs, rel: clean };
}

async function logStart(ctx: ToolCtx, name: string, input: unknown) {
  const { data } = await sb3
    .from("tool_call_registry")
    .insert({
      thread_id: ctx.threadId,
      message_id: ctx.messageId,
      project_id: ctx.projectUuid,
      agent_slug: ctx.agentSlug,
      tool_name: name,
      input: input ?? {},
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  return (data?.id as string | undefined) ?? null;
}

async function logEnd(id: string | null, status: "ok" | "error" | "aborted", output: unknown, ms: number) {
  if (!id) return;
  await sb3
    .from("tool_call_registry")
    .update({
      status,
      output: safeJson(output),
      duration_ms: ms,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
}

function safeJson(v: unknown) {
  try {
    const s = JSON.stringify(v ?? null);
    return s.length > 20000 ? JSON.parse(JSON.stringify({ truncated: true, preview: s.slice(0, 20000) })) : JSON.parse(s);
  } catch {
    return { unserializable: String(v).slice(0, 2000) };
  }
}

/** Wrap a tool execute with registry logging + abort awareness. */
function traced<I, O>(name: string, ctx: ToolCtx, fn: (input: I) => Promise<O>) {
  return async (input: I): Promise<O | { ok: false; error: string }> => {
    const t0 = Date.now();
    const id = await logStart(ctx, name, input);
    if (ctx.abortSignal?.aborted) {
      await logEnd(id, "aborted", { reason: "cancelled before start" }, Date.now() - t0);
      return { ok: false, error: "aborted" };
    }
    try {
      const out = await fn(input);
      await logEnd(id, "ok", out, Date.now() - t0);
      return out;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logEnd(id, ctx.abortSignal?.aborted ? "aborted" : "error", { error: message }, Date.now() - t0);
      return { ok: false, error: message };
    }
  };
}

function run(cmd: string, args: string[], cwd: string, timeoutMs = 120_000) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(cmd, args, { cwd, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        code: err && typeof (err as { code?: number }).code === "number" ? (err as { code: number }).code : err ? 1 : 0,
        stdout: String(stdout ?? "").slice(0, 60_000),
        stderr: String(stderr ?? "").slice(0, 20_000),
      });
    });
  });
}

/** Mirror a file into Supabase 3 `project_files` (single source of truth for UI). */
async function mirrorFile(ctx: ToolCtx, rel: string, content: string | null, deleted = false) {
  if (deleted) {
    await sb3.from("project_files").update({ is_deleted: true, updated_by: ctx.userId ?? null })
      .eq("project_id", ctx.projectUuid).eq("path", rel);
    return;
  }
  const body = content ?? "";
  await sb3.from("project_files").upsert(
    {
      project_id: ctx.projectUuid,
      path: rel,
      content: body,
      size_bytes: Buffer.byteLength(body, "utf8"),
      checksum: createHash("sha256").update(body).digest("hex"),
      is_deleted: false,
      updated_by: ctx.userId ?? null,
    },
    { onConflict: "project_id,path" },
  );
}

async function readProjectFile(ctx: ToolCtx, rel: string): Promise<string> {
  const { abs, rel: clean } = safePath(ctx, rel);
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    const { data } = await sb3
      .from("project_files")
      .select("content")
      .eq("project_id", ctx.projectUuid)
      .eq("path", clean)
      .eq("is_deleted", false)
      .maybeSingle();
    if (typeof data?.content === "string") return data.content;
    throw new Error(`file not found: ${clean}`);
  }
}

/* ────────────────────────── the 12 tools ────────────────────────── */

export function buildAgentTools(ctx: ToolCtx) {
  return {
    /* 1 */
    write_file: tool({
      description: "Create or overwrite a project file. Writes disk + mirrors into project_files.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: traced("write_file", ctx, async ({ path: rel, content }) => {
        const { abs, rel: clean } = safePath(ctx, rel);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content, "utf8");
        await mirrorFile(ctx, clean, content);
        return { ok: true as const, path: clean, bytes: Buffer.byteLength(content, "utf8") };
      }),
    }),

    /* 2 */
    read_file: tool({
      description: "Read a project file (disk first, project_files fallback).",
      inputSchema: z.object({ path: z.string(), maxBytes: z.number().optional() }),
      execute: traced("read_file", ctx, async ({ path: rel, maxBytes }) => {
        const content = await readProjectFile(ctx, rel);
        const limit = maxBytes && maxBytes > 0 ? maxBytes : 200_000;
        return { ok: true as const, path: rel, truncated: content.length > limit, content: content.slice(0, limit) };
      }),
    }),

    /* 3 */
    line_replace: tool({
      description: "Replace an inclusive 1-indexed line range in a file. Fails if oldContent does not match.",
      inputSchema: z.object({
        path: z.string(),
        firstLine: z.number(),
        lastLine: z.number(),
        oldContent: z.string(),
        newContent: z.string(),
      }),
      execute: traced("line_replace", ctx, async ({ path: rel, firstLine, lastLine, oldContent, newContent }) => {
        const current = await readProjectFile(ctx, rel);
        const lines = current.split("\n");
        if (firstLine < 1 || lastLine < firstLine || lastLine > lines.length) {
          throw new Error(`range ${firstLine}-${lastLine} out of bounds (file has ${lines.length} lines)`);
        }
        const slice = lines.slice(firstLine - 1, lastLine).join("\n");
        if (slice.trim() !== oldContent.trim()) {
          throw new Error("oldContent mismatch — re-read the file before editing");
        }
        const next = [...lines.slice(0, firstLine - 1), ...newContent.split("\n"), ...lines.slice(lastLine)].join("\n");
        const { abs, rel: clean } = safePath(ctx, rel);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, next, "utf8");
        await mirrorFile(ctx, clean, next);
        return { ok: true as const, path: clean, lines: next.split("\n").length };
      }),
    }),

    /* 4 */
    grep: tool({
      description: "Search project files with ripgrep (falls back to grep -rn).",
      inputSchema: z.object({ pattern: z.string(), glob: z.string().optional(), maxResults: z.number().optional() }),
      execute: traced("grep", ctx, async ({ pattern, glob, maxResults }) => {
        const cwd = projectDir(ctx);
        const cap = Math.min(Math.max(maxResults ?? 60, 1), 300);
        const rgArgs = ["-n", "--no-heading", "-m", "5", pattern];
        if (glob) rgArgs.push("-g", glob);
        let res = await run("rg", rgArgs, cwd, 30_000);
        if (res.code > 1 && !res.stdout) res = await run("grep", ["-rn", pattern, "."], cwd, 30_000);
        const matches = res.stdout.split("\n").filter(Boolean).slice(0, cap);
        return { ok: true as const, pattern, count: matches.length, matches };
      }),
    }),

    /* 5 — needsApproval: mutating SQL never runs unattended */
    run_sql: tool({
      description: "Run SQL against the project database. Requires founder approval.",
      inputSchema: z.object({ sql: z.string(), dryRun: z.boolean().optional() }),
      needsApproval: true,
      execute: traced("run_sql", ctx, async ({ sql, dryRun }) => {
        const statement = sql.trim();
        if (!statement) throw new Error("empty sql");
        if (dryRun) {
          const r = await fetch(`${BRIDGE_SELF_URL}/rpc/sql.validate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sql: statement }),
          });
          return { ok: r.ok, dryRun: true as const, validation: await r.text().then((t) => t.slice(0, 4000)) };
        }
        const url = process.env['DATABASE_URL'];
        if (!url) throw new Error("DATABASE_URL not set on bridge");
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: url });
        await client.connect();
        try {
          const out = await client.query(statement);
          const rows = Array.isArray(out.rows) ? out.rows.slice(0, 100) : [];
          return { ok: true as const, command: out.command, rowCount: out.rowCount ?? rows.length, rows };
        } finally {
          await client.end().catch(() => {});
        }
      }),
    }),

    /* 6 */
    lsp_lookup: tool({
      description: "TypeScript diagnostics for the project (tsc --noEmit), optionally filtered to one file.",
      inputSchema: z.object({ path: z.string().optional() }),
      execute: traced("lsp_lookup", ctx, async ({ path: rel }) => {
        const cwd = projectDir(ctx);
        const res = await run("bunx", ["tsgo", "--noEmit", "--pretty", "false"], cwd, 180_000);
        const raw = `${res.stdout}\n${res.stderr}`;
        const lineRe = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;
        const diagnostics = raw
          .split("\n")
          .map((l) => l.match(lineRe))
          .filter(Boolean)
          .map((m) => ({
            path: m![1],
            line: Number(m![2]),
            column: Number(m![3]),
            severity: m![4] as "error" | "warning",
            code: m![5],
            message: m![6],
          }))
          .filter((d) => !rel || d.path.replace(/^\.\//, "").endsWith(rel.replace(/^\/+/, "")))
          .slice(0, 200);
        return { ok: res.code === 0, errorCount: diagnostics.filter((d) => d.severity === "error").length, diagnostics };
      }),
    }),

    /* 7 */
    run_tests: tool({
      description: "Run the project's test suite (bun test / vitest run) and return the summary.",
      inputSchema: z.object({ filter: z.string().optional() }),
      execute: traced("run_tests", ctx, async ({ filter }) => {
        const cwd = projectDir(ctx);
        const args = filter ? ["test", filter] : ["test"];
        const res = await run("bun", args, cwd, 300_000);
        const out = `${res.stdout}\n${res.stderr}`;
        const pass = Number(out.match(/(\d+)\s+pass/i)?.[1] ?? 0);
        const fail = Number(out.match(/(\d+)\s+fail/i)?.[1] ?? 0);
        return { ok: res.code === 0 && fail === 0, pass, fail, tail: out.slice(-6000) };
      }),
    }),

    /* 8 */
    screenshot_preview: tool({
      description: "Capture a PNG screenshot of the live preview and store it in the project-shots bucket.",
      inputSchema: z.object({ route: z.string().optional(), width: z.number().optional(), height: z.number().optional() }),
      execute: traced("screenshot_preview", ctx, async ({ route, width, height }) => {
        const target = `${PREVIEW_BASE_URL.replace(/\/$/, "")}${route?.startsWith("/") ? route : `/${route ?? ""}`}`;
        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ args: ["--no-sandbox"] });
        try {
          const page = await browser.newPage({ viewport: { width: width ?? 1280, height: height ?? 800 } });
          await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45_000 });
          const buf = await page.screenshot({ type: "png" });
          const key = `${ctx.projectUuid}/${Date.now()}.png`;
          const up = await sb3.storage.from("project-shots").upload(key, buf, { contentType: "image/png", upsert: true });
          if (up.error) throw up.error;
          const { data } = sb3.storage.from("project-shots").getPublicUrl(key);
          return { ok: true as const, url: data.publicUrl, route: target };
        } finally {
          await browser.close().catch(() => {});
        }
      }),
    }),

    /* 9 */
    fetch_url: tool({
      description: "HTTP GET a public URL and return text (private/loopback hosts are blocked).",
      inputSchema: z.object({ url: z.string(), maxBytes: z.number().optional() }),
      execute: traced("fetch_url", ctx, async ({ url, maxBytes }) => {
        const u = new URL(url);
        if (!/^https?:$/.test(u.protocol)) throw new Error("only http/https allowed");
        if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i.test(u.hostname)) {
          throw new Error("private/loopback hosts are blocked");
        }
        const res = await fetch(u.toString(), {
          redirect: "follow",
          signal: ctx.abortSignal ?? AbortSignal.timeout(20_000),
          headers: { "user-agent": "AXONETIS-Agent/1.0" },
        });
        const text = (await res.text()).slice(0, Math.min(maxBytes ?? 120_000, 400_000));
        return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type"), text };
      }),
    }),

    /* 10 */
    git_commit: tool({
      description: "Stage, commit and push the project repository.",
      inputSchema: z.object({ message: z.string(), push: z.boolean().optional() }),
      execute: traced("git_commit", ctx, async ({ message, push }) => {
        const cwd = projectDir(ctx);
        const safeMsg = message.replace(/["`$\\]/g, "").slice(0, 300) || "AXONETIS agent commit";
        await run("git", ["add", "-A"], cwd, 60_000);
        const commit = await run("git", ["commit", "-m", safeMsg], cwd, 60_000);
        if (commit.code !== 0 && /nothing to commit/i.test(commit.stdout)) {
          return { ok: true as const, committed: false, note: "nothing to commit" };
        }
        if (commit.code !== 0) throw new Error(commit.stderr || commit.stdout || "git commit failed");
        const sha = (await run("git", ["rev-parse", "--short", "HEAD"], cwd, 30_000)).stdout.trim();
        let pushed = false;
        if (push !== false) {
          const p = await run("git", ["push", "origin", "HEAD"], cwd, 120_000);
          pushed = p.code === 0;
        }
        await sb3.from("commits").insert({
          project_id: ctx.projectUuid, sha, message: safeMsg, author: ctx.agentSlug, pushed,
        }).select("id").maybeSingle();
        return { ok: true as const, committed: true, sha, pushed };
      }),
    }),

    /* 11 — needsApproval: deploys are irreversible for the founder's live site */
    deploy: tool({
      description: "Publish the project (build + deploy). Requires founder approval.",
      inputSchema: z.object({ target: z.enum(["preview", "production"]).optional(), note: z.string().optional() }),
      needsApproval: true,
      execute: traced("deploy", ctx, async ({ target, note }) => {
        const res = await fetch(`${BRIDGE_SELF_URL}/rpc/publish.deploy`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId: ctx.projectId, target: target ?? "production", note: note ?? null }),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`publish.deploy ${res.status}: ${text.slice(0, 300)}`);
        return { ok: true as const, status: res.status, result: text.slice(0, 4000) };
      }),
    }),

    /* 12 — swarm entrypoint, hard cap 5 concurrent workers */
    spawn_subagent: tool({
      description:
        "Delegate a scoped task to a sub-agent (sherlock or an industry advisor). Max 5 live sub-agents per thread.",
      inputSchema: z.object({
        agent: z.enum(["sherlock", "aria", "orion", "rex", "lyra", "sage", "atlas", "vega", "kai"]),
        task: z.string(),
        context: z.string().optional(),
      }),
      execute: traced("spawn_subagent", ctx, async ({ agent, task, context }) => {
        const { count } = await sb3
          .from("agent_subagents")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", ctx.threadId)
          .in("status", ["queued", "running"]);
        if ((count ?? 0) >= MAX_SUBAGENTS) throw new Error(`sub-agent cap reached (${MAX_SUBAGENTS} live)`);

        // Phase 3.10.10: real execution record (cap + depth enforced by DB trigger too)
        const { data: sub, error: subErr } = await sb3
          .from("agent_subagents")
          .insert({
            thread_id: ctx.threadId,
            message_id: ctx.messageId,
            project_id: ctx.projectId,
            parent_agent: ctx.agentSlug,
            agent,
            task,
            context: context ?? null,
            status: "running",
          })
          .select("id")
          .single();
        if (subErr) throw new Error(subErr.message);

        const res = await fetch(`${BRIDGE_SELF_URL}/rpc/delegate.create`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            threadId: ctx.threadId,
            messageId: ctx.messageId,
            projectId: ctx.projectId,
            parentAgent: ctx.agentSlug,
            tasks: [{ agent, title: task.slice(0, 160), detail: context ?? null }],
          }),
        });
        const text = await res.text();
        if (!res.ok) {
          await sb3
            .from("agent_subagents")
            .update({ status: "failed", result: text.slice(0, 2000) })
            .eq("id", sub.id);
          throw new Error(`delegate.create ${res.status}: ${text.slice(0, 300)}`);
        }
        let delegationId: string | null = null;
        try {
          delegationId = (JSON.parse(text) as { delegation_id?: string }).delegation_id ?? null;
        } catch { /* raw text response */ }
        await sb3
          .from("agent_subagents")
          .update({ delegation_id: delegationId, result: text.slice(0, 2000) })
          .eq("id", sub.id);

        return {
          ok: true as const,
          agent,
          subagent_id: sub.id as string,
          delegation_id: delegationId,
          live: (count ?? 0) + 1,
        };
      }),
    }),
  };
}

export const AGENT_TOOL_NAMES = [
  "write_file", "read_file", "line_replace", "grep", "run_sql", "lsp_lookup",
  "run_tests", "screenshot_preview", "fetch_url", "git_commit", "deploy", "spawn_subagent",
] as const;

/** Tools that must never auto-execute without founder approval. */
export const APPROVAL_TOOLS = ["run_sql", "deploy"] as const;
