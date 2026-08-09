/**
 * Phase 10.4 — Screenshot Vision bridge routes (hostflow-server, port 8090).
 * Mount:  app.use(visionRoutes)   in src/routes/index.ts
 *
 *   POST /rpc/vision.upload   { projectId, filename, mime, dataUrl } → VisionShot
 *   GET  /rpc/vision.list?projectId                                 → { shots }
 *   POST /rpc/vision.analyze  { projectId, shotId }                 → VisionAnalysis
 *   POST /rpc/vision.apply    { projectId, shotId, suggestionId }   → { ok, diff_id }
 *
 * Tables: vision_shots · vision_analyses (Supabase 3)
 * SQL: sql/founder/phase-10-advantage/20260816000000_phase_104_1015.sql
 * Vision model: OpenRouter multimodal (OPENROUTER_API_KEY) — server-only.
 */
import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
router.use(express.json({ limit: "25mb" }));

const sb = () =>
  createClient(process.env.SUPABASE3_URL, process.env.SUPABASE3_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const bad = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });

const VISION_MODEL = process.env.VISION_MODEL || "google/gemini-2.0-flash-001";

function shotRow(r) {
  return {
    id: r.id,
    filename: r.filename,
    url: r.data_url ?? null,
    width: r.width ?? null,
    height: r.height ?? null,
    created_at: r.created_at,
    analyzed: !!r.analyzed_at,
  };
}

// ── upload ──────────────────────────────────────────────────────────────────
router.post("/rpc/vision.upload", async (req, res) => {
  const { projectId, filename, mime, dataUrl } = req.body ?? {};
  if (!projectId || !dataUrl) return bad(res, "projectId and dataUrl required");
  if (!/^data:image\//.test(dataUrl)) return bad(res, "dataUrl must be an image");

  const { data, error } = await sb()
    .from("vision_shots")
    .insert({
      project_id: projectId,
      filename: filename || "screenshot.png",
      mime: mime || "image/png",
      data_url: dataUrl,
      bytes: Math.round((dataUrl.length * 3) / 4),
    })
    .select("*")
    .single();

  if (error) return bad(res, error.message, 500);
  res.json(shotRow(data));
});

// ── list ────────────────────────────────────────────────────────────────────
router.get("/rpc/vision.list", async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return bad(res, "projectId required");
  const { data, error } = await sb()
    .from("vision_shots")
    .select("id, filename, data_url, width, height, created_at, analyzed_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return bad(res, error.message, 500);
  res.json({ shots: (data ?? []).map(shotRow) });
});

// ── analyze (element map + numbered suggestions) ────────────────────────────
const ANALYZE_PROMPT = `You are a senior product designer reviewing a UI screenshot.
Return STRICT JSON only:
{"summary":"one line","elements":[{"label":"button|nav|hero|card|input|text","confidence":0-100,"x":0-1,"y":0-1,"w":0-1,"h":0-1}],
"suggestions":[{"title":"short","detail":"what to change and why","path":"src/... or null","elementIndex":0,"severity":"info|improve|fix"}]}
Max 12 elements, max 6 suggestions. Coordinates normalized 0..1 from top-left.`;

router.post("/rpc/vision.analyze", async (req, res) => {
  const { projectId, shotId } = req.body ?? {};
  if (!projectId || !shotId) return bad(res, "projectId and shotId required");
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_2;
  if (!key) return bad(res, "OPENROUTER_API_KEY missing on server", 500);

  const db = sb();
  const { data: shot, error: shotErr } = await db
    .from("vision_shots")
    .select("id, data_url")
    .eq("project_id", projectId)
    .eq("id", shotId)
    .maybeSingle();
  if (shotErr) return bad(res, shotErr.message, 500);
  if (!shot) return bad(res, "shot not found", 404);

  let parsed;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: ANALYZE_PROMPT },
              { type: "image_url", image_url: { url: shot.data_url } },
            ],
          },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) return bad(res, j?.error?.message || `vision model ${r.status}`, 502);
    const text = j?.choices?.[0]?.message?.content ?? "";
    const jsonText = String(text).replace(/^```(?:json)?|```$/gm, "").trim();
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return bad(res, `vision analyze failed: ${e?.message ?? e}`, 502);
  }

  const elements = (parsed.elements ?? []).slice(0, 12).map((el, i) => ({
    id: `el_${i}`,
    label: String(el.label ?? "element"),
    confidence: Number(el.confidence ?? 0),
    x: Number(el.x ?? 0),
    y: Number(el.y ?? 0),
    w: Number(el.w ?? 0),
    h: Number(el.h ?? 0),
  }));
  const suggestions = (parsed.suggestions ?? []).slice(0, 6).map((s, i) => ({
    id: `sg_${i}`,
    index: i + 1,
    title: String(s.title ?? "suggestion"),
    detail: String(s.detail ?? ""),
    path: s.path ?? null,
    elementId:
      Number.isInteger(s.elementIndex) && elements[s.elementIndex]
        ? elements[s.elementIndex].id
        : null,
    severity: ["info", "improve", "fix"].includes(s.severity) ? s.severity : "improve",
  }));

  const analysis = {
    shotId,
    model: VISION_MODEL,
    summary: String(parsed.summary ?? ""),
    elements,
    suggestions,
    created_at: new Date().toISOString(),
  };

  await db.from("vision_analyses").insert({
    project_id: projectId,
    shot_id: shotId,
    model: VISION_MODEL,
    summary: analysis.summary,
    elements,
    suggestions,
  });
  await db.from("vision_shots").update({ analyzed_at: analysis.created_at }).eq("id", shotId);

  res.json(analysis);
});

// ── apply one suggestion → queue a founder-approvable diff ──────────────────
router.post("/rpc/vision.apply", async (req, res) => {
  const { projectId, shotId, suggestionId } = req.body ?? {};
  if (!projectId || !shotId || !suggestionId)
    return bad(res, "projectId, shotId and suggestionId required");

  const db = sb();
  const { data: an, error } = await db
    .from("vision_analyses")
    .select("suggestions")
    .eq("project_id", projectId)
    .eq("shot_id", shotId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return bad(res, error.message, 500);
  const sug = (an?.suggestions ?? []).find((s) => s.id === suggestionId);
  if (!sug) return bad(res, "suggestion not found", 404);

  const { data: diff, error: diffErr } = await db
    .from("agent_diffs")
    .insert({
      project_id: projectId,
      path: sug.path ?? "src/unknown.tsx",
      status: "pending",
      source: "vision",
      summary: sug.title,
      instruction: sug.detail,
    })
    .select("id")
    .single();
  if (diffErr) return bad(res, diffErr.message, 500);

  res.json({ ok: true, diff_id: diff.id });
});

export default router;
