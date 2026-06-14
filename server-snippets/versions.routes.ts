// ============================================================
// ⚠️ YEH HOSTFLOW-SERVER (BRIDGE) REPO KI FILE HAI
// Path on Hetzner: /opt/hostflow-ecosystem/hostflow-server/src/routes/versions.routes.ts
// Phase 6 — Version Control & Recovery (snapshots / deployments / rollback)
//
// Mount in src/index.ts:
//   import versionsRouter from "./routes/versions.routes.js";
//   app.use("/api/versions", versionsRouter);
// ============================================================
import { Router, type Request, type Response } from "express";
import { supabase3 as supabase } from "../integrations/supabase3/client.js";

const router = Router();

// ── GET /api/versions/snapshots?projectId=...&limit=50
// Latest file_versions across the project (timeline feed)
router.get("/snapshots", async (req: Request, res: Response) => {
  const projectId = String(req.query.projectId ?? "");
  const limit = Math.min(Number(req.query.limit ?? 50), 500);
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  const { data, error } = await supabase
    .from("file_versions")
    .select("id, path, change, author, message, created_at, env, branch")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ snapshots: data ?? [] });
});

// ── GET /api/versions/deployments?projectId=...
router.get("/deployments", async (req: Request, res: Response) => {
  const projectId = String(req.query.projectId ?? "");
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  const { data, error } = await supabase
    .from("deployments")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ deployments: data ?? [] });
});

// ── GET /api/versions/diff?fromVersionId=...&toVersionId=...
router.get("/diff", async (req: Request, res: Response) => {
  const fromId = String(req.query.fromVersionId ?? "");
  const toId = String(req.query.toVersionId ?? "");
  if (!fromId || !toId) return res.status(400).json({ error: "fromVersionId & toVersionId required" });

  const { data, error } = await supabase
    .from("file_versions")
    .select("id, path, content, checksum, created_at")
    .in("id", [fromId, toId]);

  if (error) return res.status(500).json({ error: error.message });
  const from = data?.find((d) => d.id === fromId);
  const to = data?.find((d) => d.id === toId);
  return res.json({ from, to });
});

// ── POST /api/versions/rollback
// body: { projectId, scope: "file"|"deployment", targetId, reason?, triggeredBy? }
router.post("/rollback", async (req: Request, res: Response) => {
  const { projectId, scope, targetId, reason, triggeredBy } = req.body ?? {};
  if (!projectId || !scope || !targetId) {
    return res.status(400).json({ error: "projectId, scope, targetId required" });
  }

  try {
    if (scope === "file") {
      // Restore a single file_versions snapshot into project_files
      const { data: v, error: vErr } = await supabase
        .from("file_versions")
        .select("*")
        .eq("id", targetId)
        .single();
      if (vErr || !v) throw new Error(vErr?.message ?? "version not found");

      const { error: upErr } = await supabase
        .from("project_files")
        .upsert({
          project_id: v.project_id,
          env: v.env,
          branch: v.branch,
          path: v.path,
          content: v.content,
          checksum: v.checksum,
          updated_by: triggeredBy ?? "rollback",
        }, { onConflict: "project_id,env,branch,path" });
      if (upErr) throw upErr;
    } else if (scope === "deployment") {
      // Mark this deployment as current; flip prior current=false
      const { data: dep, error: dErr } = await supabase
        .from("deployments")
        .select("*")
        .eq("id", targetId)
        .single();
      if (dErr || !dep) throw new Error(dErr?.message ?? "deployment not found");

      await supabase.from("deployments")
        .update({ current: false })
        .eq("project_id", dep.project_id)
        .eq("target_env", dep.target_env);

      await supabase.from("deployments")
        .update({ current: true, status: "live" })
        .eq("id", targetId);
    } else {
      return res.status(400).json({ error: "scope must be file or deployment" });
    }

    const { data: log } = await supabase
      .from("rollback_history")
      .insert({
        project_id: projectId,
        scope,
        target_id: targetId,
        reason: reason ?? null,
        triggered_by: triggeredBy ?? "founder",
        succeeded: true,
      })
      .select()
      .single();

    return res.json({ ok: true, log });
  } catch (err) {
    await supabase.from("rollback_history").insert({
      project_id: projectId,
      scope,
      target_id: targetId,
      reason: reason ?? null,
      triggered_by: triggeredBy ?? "founder",
      succeeded: false,
      notes: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/versions/rollback-history?projectId=...
router.get("/rollback-history", async (req: Request, res: Response) => {
  const projectId = String(req.query.projectId ?? "");
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  const { data, error } = await supabase
    .from("rollback_history")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ history: data ?? [] });
});

export default router;
