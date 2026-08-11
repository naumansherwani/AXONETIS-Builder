// ============================================================
// AXONETIS™ Builder — Explainability + Workspace Memory write path
// Target Hetzner path:
//   /opt/hostflow-ecosystem/hostflow-server/src/routes/explain.routes.ts
//
// Mount (NO DUPLICATE router):
//   import explainRouter from "./routes/explain.routes.js";
//   app.use("/rpc", explainRouter);
//
// Frontend contracts:
//   GET  /rpc/explain.get?projectId&messageId   → Explanation  (WhyTooltip)
//   POST /rpc/explain.record                    → save why/model/chain/memory refs
//   POST /rpc/memory.write                      → workspace memory upsert
//   GET  /rpc/memory.list?projectId&limit       → workspace memory rows
//
// Tables (Supabase 3):
//   agent_explanations(message_id pk, project_slug, why, model, model_reason,
//                      tokens_in, tokens_out, cost_usd, chain jsonb, tools jsonb,
//                      memory_refs jsonb, created_at)
//   workspace_memory(id pk, project_slug, title, content, kind, importance,
//                    message_id, created_at)
// ============================================================

import { Router, type Request, type Response } from "express";
import { supabase3 as supabase } from "../integrations/supabase3/client.js";

const router = Router();

const bad = (res: Response, message: string, code = 400) => res.status(code).json({ error: message });
const oops = (res: Response, err: unknown) =>
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) });

router.post("/explain.record", async (req: Request, res: Response) => {
  try {
    const projectId = String(req.body?.projectId ?? "").trim();
    const messageId = String(req.body?.messageId ?? "").trim();
    if (!projectId || !messageId) return bad(res, "projectId + messageId required");

    const row = {
      message_id: messageId,
      project_slug: projectId,
      why: String(req.body?.why ?? "").slice(0, 4000) || null,
      model: req.body?.model ?? null,
      model_reason: req.body?.modelReason ?? null,
      tokens_in: Number(req.body?.tokensIn ?? 0) || null,
      tokens_out: Number(req.body?.tokensOut ?? 0) || null,
      cost_usd: Number(req.body?.costUsd ?? 0) || null,
      chain: Array.isArray(req.body?.chain) ? req.body.chain : [],
      tools: Array.isArray(req.body?.tools) ? req.body.tools : [],
      memory_refs: Array.isArray(req.body?.memory) ? req.body.memory : [],
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("agent_explanations")
      .upsert(row, { onConflict: "message_id" });
    if (error) throw error;

    // Workspace memory: har answered turn ka ek compact memory row.
    const title = String(req.body?.memoryTitle ?? "").slice(0, 200);
    const content = String(req.body?.memoryContent ?? "").slice(0, 8000);
    if (title && content) {
      await supabase.from("workspace_memory").insert({
        project_slug: projectId,
        message_id: messageId,
        title,
        content,
        kind: String(req.body?.memoryKind ?? "episodic"),
        importance: Number(req.body?.memoryImportance ?? 3),
      });
    }

    return res.json({ ok: true, messageId });
  } catch (err) {
    return oops(res, err);
  }
});

router.get("/explain.get", async (req: Request, res: Response) => {
  try {
    const projectId = String(req.query.projectId ?? "").trim();
    const messageId = String(req.query.messageId ?? "").trim();
    if (!projectId || !messageId) return bad(res, "projectId + messageId required");

    const { data, error } = await supabase
      .from("agent_explanations")
      .select("*")
      .eq("message_id", messageId)
      .maybeSingle();
    if (error) throw error;

    const { data: mem } = await supabase
      .from("workspace_memory")
      .select("id, title, content, importance")
      .eq("project_slug", projectId)
      .order("created_at", { ascending: false })
      .limit(5);

    const memory =
      (Array.isArray(data?.memory_refs) && data.memory_refs.length
        ? data.memory_refs
        : (mem ?? []).map((m) => ({
            id: m.id,
            title: m.title,
            snippet: String(m.content ?? "").slice(0, 180),
            score: m.importance ?? null,
          }))) ?? [];

    if (!data) {
      return res.json({
        messageId,
        why: "Is message ka explainability record abhi record nahi hua.",
        model: null,
        modelReason: null,
        tokensIn: null,
        tokensOut: null,
        costUsd: null,
        memory,
        tools: [],
        chain: [],
      });
    }

    return res.json({
      messageId,
      why: data.why ?? "",
      model: data.model ?? null,
      modelReason: data.model_reason ?? null,
      tokensIn: data.tokens_in ?? null,
      tokensOut: data.tokens_out ?? null,
      costUsd: data.cost_usd ?? null,
      memory,
      tools: data.tools ?? [],
      chain: data.chain ?? [],
    });
  } catch (err) {
    return oops(res, err);
  }
});

router.post("/memory.write", async (req: Request, res: Response) => {
  try {
    const projectId = String(req.body?.projectId ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    const content = String(req.body?.content ?? "").trim();
    if (!projectId || !title || !content) return bad(res, "projectId + title + content required");
    const { data, error } = await supabase
      .from("workspace_memory")
      .insert({
        project_slug: projectId,
        title: title.slice(0, 200),
        content: content.slice(0, 8000),
        kind: String(req.body?.kind ?? "semantic"),
        importance: Number(req.body?.importance ?? 3),
        message_id: req.body?.messageId ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return res.json({ ok: true, id: data?.id ?? null });
  } catch (err) {
    return oops(res, err);
  }
});

router.get("/memory.list", async (req: Request, res: Response) => {
  try {
    const projectId = String(req.query.projectId ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    if (!projectId) return bad(res, "projectId required");
    const { data, error } = await supabase
      .from("workspace_memory")
      .select("id, title, content, kind, importance, created_at")
      .eq("project_slug", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return oops(res, err);
  }
});

export default router;
