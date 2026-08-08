/**
 * AXONETIS Phase 3.10.8 — LSP diagnostics routes (bridge)
 * Target file: /opt/hostflow-ecosystem/hostflow-server/src/routes/lsp.routes.ts
 * Mount:       app.use("/rpc", lspRouter)   // routes are /rpc/lsp.*
 *
 * Contract (frontend 1:1, raw JSON — NO {success,data} wrapper):
 *   POST /rpc/lsp.diagnostics { projectId, path? }
 *        -> { ok, errorCount, warningCount, scanned_at, diagnostics[] }
 *        Runs `bunx tsgo --noEmit` in the project dir, replaces the project's
 *        rows in Supabase 3 `project_diagnostics` (Realtime → Problems badge).
 *   POST /rpc/lsp.autofix { projectId, threadId?, diagnostic }
 *        -> { thread_id, message_id }
 *        Real Jimmy turn: inserts a founder message describing the diagnostic
 *        on the thread so the agent worker picks it up. No client-side patching.
 *
 * Env: SUPABASE3_URL, SUPABASE3_SERVICE_ROLE_KEY, PROJECTS_ROOT (default /opt/axonetis-projects)
 */
import express, { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import path from "node:path";

const sb = createClient(
  process.env.SUPABASE3_URL as string,
  process.env.SUPABASE3_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } },
);

const PROJECTS_ROOT = process.env.PROJECTS_ROOT || "/opt/axonetis-projects";

export const lspRouter = Router();

// Self-sufficient body parsing: mount order (before/after global express.json)
// se independent rehta hai, warna req.body undefined aata hai.
lspRouter.use(express.json({ limit: "4mb" }));

interface Diag {
  path: string;
  line: number;
  column: number;
  severity: "error" | "warning";
  code: string;
  message: string;
}

function run(cmd: string, args: string[], cwd: string, timeout = 180_000) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(cmd, args, { cwd, timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err && typeof (err as { code?: number }).code === "number"
        ? ((err as { code?: number }).code as number)
        : err
          ? 1
          : 0;
      resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

function projectDir(slug: string) {
  const safe = String(slug).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe) throw new Error("invalid projectId");
  return path.join(PROJECTS_ROOT, safe);
}

async function resolveProjectUuid(slug: string): Promise<string | null> {
  const { data } = await sb.from("projects").select("id").eq("slug", slug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

function parseDiagnostics(raw: string, only?: string): Diag[] {
  const lineRe = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;
  return raw
    .split("\n")
    .map((l) => l.match(lineRe))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({
      path: m[1].replace(/^\.\//, ""),
      line: Number(m[2]),
      column: Number(m[3]),
      severity: m[4] as "error" | "warning",
      code: m[5],
      message: m[6],
    }))
    .filter((d) => !only || d.path.endsWith(String(only).replace(/^\/+/, "")))
    .slice(0, 500);
}

lspRouter.post("/lsp.diagnostics", async (req, res) => {
  try {
    const { projectId, path: only } = (req.body ?? {}) as { projectId?: string; path?: string };
    if (!projectId) return res.status(400).json({ error: "projectId required" });

    const cwd = projectDir(projectId);
    const out = await run("bunx", ["tsgo", "--noEmit", "--pretty", "false"], cwd);
    const diagnostics = parseDiagnostics(`${out.stdout}\n${out.stderr}`, only);
    const scanned_at = new Date().toISOString();

    // replace project snapshot (scoped to one file when `path` given)
    let del = sb.from("project_diagnostics").delete().eq("project_id", projectId);
    if (only) del = del.like("path", `%${only}`);
    await del;

    if (diagnostics.length > 0) {
      await sb.from("project_diagnostics").insert(
        diagnostics.map((d) => ({
          project_id: projectId,
          path: d.path,
          line: d.line,
          column: d.column,
          severity: d.severity,
          code: d.code,
          message: d.message,
          created_at: scanned_at,
        })),
      );
    }

    return res.json({
      ok: out.code === 0,
      errorCount: diagnostics.filter((d) => d.severity === "error").length,
      warningCount: diagnostics.filter((d) => d.severity === "warning").length,
      scanned_at,
      diagnostics,
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

lspRouter.post("/lsp.autofix", async (req, res) => {
  try {
    const { projectId, threadId, diagnostic } = (req.body ?? {}) as {
      projectId?: string;
      threadId?: string;
      diagnostic?: Diag;
    };
    if (!projectId || !diagnostic?.path || !diagnostic?.message) {
      return res.status(400).json({ error: "projectId and diagnostic{path,message} required" });
    }

    let thread_id = threadId;
    if (!thread_id) {
      const projectUuid = await resolveProjectUuid(projectId);
      const { data: latest } = await sb
        .from("agent_threads")
        .select("id")
        .eq("agent_slug", "jimmy")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.id) {
        thread_id = latest.id as string;
      } else {
        const { data: created, error } = await sb
          .from("agent_threads")
          .insert({ agent_slug: "jimmy", project_id: projectUuid, title: "LSP auto-fix" })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        thread_id = created.id as string;
      }
    }

    const text =
      `Fix this TypeScript diagnostic in ${diagnostic.path} ` +
      `(line ${diagnostic.line}, col ${diagnostic.column}):\n` +
      `${diagnostic.code}: ${diagnostic.message}\n\n` +
      `Read the file, apply the minimal correct fix, then re-run lsp_lookup to confirm 0 errors.`;

    const { data: msg, error: msgErr } = await sb
      .from("agent_thread_messages")
      .insert({ thread_id, role: "user", content: text, parts: [{ type: "text", text }] })
      .select("id")
      .single();
    if (msgErr) throw new Error(msgErr.message);

    await sb.from("agent_activity").insert({
      thread_id,
      agent_slug: "jimmy",
      kind: "lsp_autofix_requested",
      detail: `${diagnostic.code} ${diagnostic.path}:${diagnostic.line}`,
    });

    return res.json({ thread_id, message_id: msg.id });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});
