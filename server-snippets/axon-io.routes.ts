/**
 * Axon I/O bridge routes — hostflow-server (8090), public at /hf/*.
 * Mount: app.use(axonIoRoutes) in src/index.ts (Express entrypoint).
 *
 * Fixes the remaining dead endpoints from the deep audit:
 *   POST /api/axon/commands                  → { taskId, status }
 *   GET  /api/axon/bridge/health?projectId    → { status, checkedAt }
 *   POST /api/agents/stream/:streamId/cancel   → { ok, status }
 *   POST /api/uploads          (multipart)     → { url, name, contentType, size }
 *   POST /api/voice/transcribe (multipart)     → { text }
 *
 * NO dummy data: uploads go to Supabase 3 storage, transcription goes to Groq
 * whisper-large-v3, cancel hits the real AbortController registry.
 *
 * Deps: express, multer, @supabase/supabase-js
 * Env:  SUPABASE3_URL · SUPABASE3_SERVICE_ROLE_KEY · GROQ_API_KEY
 */
import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { cancelRun, isCancelled } from "./agents.cancel.js";

const router = express.Router();
router.use(express.json({ limit: "2mb" }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const sb = () =>
  createClient(process.env.SUPABASE3_URL!, process.env.SUPABASE3_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

const UPLOAD_BUCKET = process.env.AXON_UPLOAD_BUCKET ?? "builder-uploads";

/* ───────────────────── bridge health ───────────────────── */
router.get("/api/axon/bridge/health", async (req, res) => {
  const projectId = String(req.query.projectId ?? "");
  const checkedAt = new Date().toISOString();
  try {
    const { error } = await sb().from("projects").select("id", { head: true, count: "exact" });
    if (error) return res.json({ status: "degraded", checkedAt, projectId, error: error.message });
    res.json({ status: "ok", checkedAt, projectId });
  } catch (e) {
    res.json({ status: "down", checkedAt, projectId, error: (e as Error).message });
  }
});

/* ───────────────────── builder commands ─────────────────── */
router.post("/api/axon/commands", async (req, res) => {
  const { projectId, type, payload } = req.body ?? {};
  if (!projectId || !type) return res.status(400).json({ error: "projectId and type required" });
  try {
    const { data, error } = await sb()
      .from("tool_call_registry")
      .insert({
        project_id: projectId,
        tool_name: `axon.${type}`,
        status: "queued",
        input: payload ?? {},
      })
      .select("id")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ taskId: String(data.id), status: "queued" });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/* ───────────────────── stream cancel ────────────────────── */
router.post("/api/agents/stream/:streamId/cancel", (req, res) => {
  const id = String(req.params.streamId);
  const ok = cancelRun(id, "user_stop");
  res.json({ ok, status: ok ? "aborted" : isCancelled(id) ? "already_aborted" : "not_found" });
});

/* ───────────────────── uploads ──────────────────────────── */
router.post("/api/uploads", upload.single("file"), async (req, res) => {
  const file = (req as unknown as { file?: { buffer: Buffer; originalname: string; mimetype: string; size: number } }).file;
  const projectId = String((req.body ?? {}).projectId ?? "shared");
  if (!file) return res.status(400).json({ error: "file required" });
  try {
    const client = sb();
    const key = `${projectId}/${Date.now()}-${file.originalname.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await client.storage
      .from(UPLOAD_BUCKET)
      .upload(key, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) return res.status(500).json({ error: error.message });
    const { data } = client.storage.from(UPLOAD_BUCKET).getPublicUrl(key);
    res.json({
      id: key,
      url: data.publicUrl,
      name: file.originalname,
      contentType: file.mimetype,
      size: file.size,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/* ───────────────────── voice transcribe ─────────────────── */
router.post("/api/voice/transcribe", upload.single("audio"), async (req, res) => {
  const file = (req as unknown as { file?: { buffer: Buffer; originalname: string; mimetype: string } }).file;
  if (!file) return res.status(400).json({ error: "audio required" });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: "GROQ_API_KEY not configured" });
  try {
    const form = new FormData();
    form.set(
      "file",
      new Blob([file.buffer], { type: file.mimetype || "audio/webm" }),
      file.originalname || "voice.webm",
    );
    form.set("model", "whisper-large-v3");
    form.set("response_format", "json");
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const j = (await r.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };
    if (!r.ok) return res.status(r.status).json({ error: j.error?.message ?? `HTTP ${r.status}` });
    res.json({ text: (j.text ?? "").trim() });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
