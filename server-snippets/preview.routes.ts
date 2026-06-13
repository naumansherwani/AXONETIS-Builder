// ============================================================
// ⚠️ YEH HOSTFLOW-SERVER (BRIDGE) REPO KI FILE HAI
// Path on Hetzner: /opt/hostflow-ecosystem/hostflow-server/src/routes/preview.routes.ts
// Phase 5 — Custom HostFlow Preview Engine (replaces Docker sandboxes)
//
// Mount in src/index.ts:
//   import previewRouter from "./routes/preview.routes.js";
//   app.use("/api/preview", previewRouter);
// ============================================================
import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE3_URL!,
  process.env.SUPABASE3_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const PROJECT_PREVIEW_URLS: Record<string, { sandbox: string; production: string }> = {
  hostflowai: {
    sandbox: "https://sandbox.hostflowai.net",
    production: "https://hostflowai.net",
  },
  rapidpay: {
    sandbox: "https://sandbox.rapidpay.hostflowai.net",
    production: "https://rapidpay.hostflowai.net",
  },
  founderbuilder: {
    sandbox: "https://sandbox.aiaxonetis.hostflowai.net",
    production: "https://aiaxonetis.hostflowai.net",
  },
};

function previewUrlFor(projectId: string, env: "sandbox" | "production"): string {
  return PROJECT_PREVIEW_URLS[projectId]?.[env] ?? "";
}

const router = Router();

// ── GET /api/preview/session?projectId=...&env=sandbox|production
router.get("/session", async (req: Request, res: Response) => {
  const projectId = String(req.query.projectId ?? "");
  const env = String(req.query.env ?? "sandbox") as "sandbox" | "production";
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  const { data, error } = await supabase
    .from("preview_sessions")
    .select("*")
    .eq("project_id", projectId)
    .eq("env", env)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? null);
});

// ── POST /api/preview/session  { projectId, env, branch }
router.post("/session", async (req: Request, res: Response) => {
  const { projectId, env, branch = "main" } = req.body ?? {};
  if (!projectId || !env) return res.status(400).json({ error: "projectId & env required" });

  const url = previewUrlFor(projectId, env);
  if (!url) return res.status(400).json({ error: "unknown projectId" });

  const { data, error } = await supabase
    .from("preview_sessions")
    .upsert(
      {
        project_id: projectId,
        env,
        branch,
        preview_url: url,
        status: "ready",
      },
      { onConflict: "project_id,env,branch" },
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ── POST /api/preview/promote  { projectId, branch }
// Promotes sandbox project_files → production (copy + bump timestamps).
router.post("/promote", async (req: Request, res: Response) => {
  const { projectId, branch = "main" } = req.body ?? {};
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  const { data: sandboxFiles, error: readErr } = await supabase
    .from("project_files")
    .select("path, content, checksum")
    .eq("project_id", projectId)
    .eq("env", "sandbox")
    .eq("branch", branch);

  if (readErr) return res.status(500).json({ error: readErr.message });
  if (!sandboxFiles || sandboxFiles.length === 0) {
    return res.status(400).json({ error: "no sandbox files to promote" });
  }

  const prodRows = sandboxFiles.map((f) => ({
    project_id: projectId,
    env: "production" as const,
    branch,
    path: f.path,
    content: f.content,
    checksum: f.checksum,
    updated_by: "promote",
  }));

  const { error: writeErr } = await supabase
    .from("project_files")
    .upsert(prodRows, { onConflict: "project_id,env,branch,path" });

  if (writeErr) return res.status(500).json({ error: writeErr.message });

  const deploymentId = crypto.randomUUID();
  return res.json({ promoted: true, deploymentId });
});

export default router;
