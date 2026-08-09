/**
 * AXONETIS — Jimmy brain routes (LIVE reference copy, saved 2026-08-07)
 * Target: /opt/hostflowai-brain/backend/src/routes/founder/jimmy.ts
 * Mount:  app.use("/api/founder", jimmyRouter)  → /api/founder/jimmy/stream
 *
 * VERSION A (AI SDK + tools) — write_file / read_file / git_commit
 * VERSION B (raw fetch SSE, currently RUNNING on Hetzner) is at the bottom
 * of this file as a commented block. Model order LOCKED:
 *   1. meta-llama/llama-3.3-70b-instruct
 *   2. nousresearch/hermes-3-llama-3.1-405b
 *   3. qwen/qwen-2.5-coder-32b-instruct
 */
import { Router } from "express";
import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import ws from "ws";
import { createClient as createSB3 } from "@supabase/supabase-js";

const router = Router();

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const sb3 = createSB3(process.env.SUPABASE3_URL!, process.env.SUPABASE3_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const PROJECTS_ROOT = process.env.PROJECTS_ROOT || "/opt/axonetis-projects";

const JIMMY_MODELS = [
  "meta-llama/llama-3.3-70b-instruct",
  "nousresearch/hermes-3-llama-3.1-405b",
  "qwen/qwen-2.5-coder-32b-instruct",
];

const write_file = tool({
  description: "Create or overwrite a file in the project",
  parameters: z.object({
    path: z.string().describe("File path relative to project root"),
    content: z.string().describe("Full file content to write"),
    projectId: z.string().describe("Project ID"),
  }),
  execute: async ({ path: filePath, content, projectId }) => {
    const fullPath = path.join(PROJECTS_ROOT, projectId, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    return { ok: true, path: filePath, bytes: content.length };
  },
});

const read_file = tool({
  description: "Read a file from the project",
  parameters: z.object({
    path: z.string().describe("File path relative to project root"),
    projectId: z.string().describe("Project ID"),
  }),
  execute: async ({ path: filePath, projectId }) => {
    const fullPath = path.join(PROJECTS_ROOT, projectId, filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    return { ok: true, path: filePath, content };
  },
});

const git_commit = tool({
  description: "Stage all changes and commit + push to GitHub",
  parameters: z.object({
    message: z.string().describe("Commit message"),
    projectId: z.string().describe("Project ID"),
  }),
  execute: async ({ message, projectId }) => {
    const cwd = path.join(PROJECTS_ROOT, projectId);
    execSync("git add -A", { cwd });
    execSync(`git commit -m "${message}"`, { cwd });
    execSync("git push origin main", { cwd });
    return { ok: true, message };
  },
});

const JIMMY_SYSTEM = (projectId: string) =>
  `Tu JIMMY hai — NEXATECT ka Lead Builder aur Founder Muhammad Nauman Sherwani ka trusted technical partner.

FOUNDER COMMUNICATION CONTRACT — STRICT:
- Founder se natural Roman Urdu/Hindi mein baat kar; sirf zaroori technical terms English mein rakh.
- Founder ke tone, language aur message length ko mirror kar. Default jawab short aur seedha ho.
- Seedha answer ya action se shuru kar. "Hi there", apna intro, corporate pitch, generic greeting, repeated offer-to-help aur English-only paragraph kabhi mat likh.
- Final answer only. Internal reasoning, self-talk, "let me think", ya hidden planning output mat dikha.
- Jo actually verify hua ho sirf woh complete bol. Pending ko pending bol. Fake success, dummy result aur over-confidence mana hai.
- Closing question sirf tab pooch jab founder ke decision ke baghair kaam genuinely blocked ho.
- Commands, paths, errors aur code identifiers exact rakho. Useful ho to clean Markdown use karo.
- Yeh founder workspace hai, customer-support chat nahi.

EXECUTION CONTRACT:
- Real production code aur existing files par kaam kar; duplicate route/file/table mat banao.
- Har actionable request par pehle inspect, phir implement, phir relevant signal verify kar.
- Sherlock audit baad mein karta hai; failed audit ko success mat bolo.
- Project ID: ${projectId}`;

function normalizeMessages(messages: unknown) {
  if (!Array.isArray(messages)) return [];
  return messages.filter((message) => {
    if (!message || typeof message !== "object") return false;
    const role = (message as { role?: unknown }).role;
    return role === "user" || role === "assistant";
  });
}

function violatesFounderVoice(text: string) {
  return /\bhi there\b|\bjimmy here\b|\bready to help\b|\bwhat can i (?:assist|help)\b|\bhow can i (?:assist|help)\b|ready ho ja(?:o|ye)|kya aap kuch specific verify|agla step bata(?:o|ayein)/i.test(text);
}

router.post("/jimmy/stream", async (req, res) => {
  const { messages, projectId } = req.body ?? {};
  if (!messages || !projectId) {
    return res.status(400).json({ error: "messages + projectId required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let lastError: any = null;

  for (const modelId of JIMMY_MODELS) {
    try {
      const result = streamText({
        model: openrouter(modelId),
        system: JIMMY_SYSTEM(projectId),
        messages: normalizeMessages(messages),
        tools: { write_file, read_file, git_commit },
        maxSteps: 50,
      });

      let fullText = "";
      for await (const chunk of result.textStream) fullText += chunk;
      if (violatesFounderVoice(fullText)) throw new Error("Founder communication contract violated");
      res.write(`data: ${JSON.stringify({ type: "text", text: fullText, model: modelId })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", model: modelId })}\n\n`);
      res.end();
      return;
    } catch (modelErr: any) {
      lastError = modelErr;
      console.warn(`[jimmy] model ${modelId} failed: ${modelErr?.message}`);
    }
  }

  res.write(
    `data: ${JSON.stringify({ type: "error", error: lastError?.message ?? "All models failed" })}\n\n`,
  );
  res.end();
});

router.post("/jimmy/orchestrate", async (_req, res) => {
  return res.json({
    success: true,
    advisor: "Jimmy",
    role: "Supreme Sovereign Commander",
    model: JIMMY_MODELS[0],
    message: "Use /jimmy/stream for real AI loop",
    timestamp: new Date().toISOString(),
  });
});

async function ensureProjectExists(projectId: string) {
  const { data } = await sb3.from("projects").select("id").eq("slug", projectId).maybeSingle();
  if (!data) {
    await sb3
      .from("projects")
      .insert({ slug: projectId, name: projectId, created_at: new Date().toISOString() });
  }
}

["hostflowai", "rapidpay", "founderbuilder"].forEach((id) => {
  ensureProjectExists(id).catch(() => {});
});

export default router;

/* ────────────────────────────────────────────────────────────────────────────
 * VERSION B — raw fetch SSE (CURRENTLY LIVE on Hetzner, plain JS, no AI SDK).
 * Verified 2026-08-07: /api/founder/jimmy/stream returns
 *   data: {"type":"done","model":"meta-llama/llama-3.3-70b-instruct"}
 *
 * import { Router } from "express";
 * import ws from "ws";
 * import { createClient as createSB3 } from "@supabase/supabase-js";
 * const router = Router();
 * const JIMMY_MODELS = [
 *   "meta-llama/llama-3.3-70b-instruct",
 *   "nousresearch/hermes-3-llama-3.1-405b",
 *   "qwen/qwen-2.5-coder-32b-instruct",
 * ];
 * const sb3 = createSB3(process.env.SUPABASE3_URL, process.env.SUPABASE3_SERVICE_ROLE_KEY,
 *   { auth: { persistSession: false }, realtime: { transport: ws } });
 * router.post("/jimmy/stream", async (req, res) => {
 *   const { messages, projectId } = req.body ?? {};
 *   if (!messages || !projectId) return res.status(400).json({ error: "messages + projectId required" });
 *   res.setHeader("Content-Type", "text/event-stream");
 *   res.setHeader("Cache-Control", "no-cache");
 *   res.setHeader("Connection", "keep-alive");
 *   res.flushHeaders();
 *   const SYSTEM = "Tu JIMMY hai NEXATECT ka Supreme Sovereign Commander... Project ID: " + projectId;
 *   const KEY = process.env.OPENROUTER_API_KEY;
 *   let lastError = null;
 *   for (const modelId of JIMMY_MODELS) {
 *     try {
 *       const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
 *         method: "POST",
 *         headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
 *         body: JSON.stringify({ model: modelId, stream: true,
 *           messages: [{ role: "system", content: SYSTEM }, ...messages] }),
 *       });
 *       if (!response.ok) throw new Error("HTTP " + response.status);
 *       const reader = response.body.getReader();
 *       const decoder = new TextDecoder();
 *       while (true) {
 *         const { done, value } = await reader.read();
 *         if (done) break;
 *         for (const line of decoder.decode(value).split("\n")) {
 *           if (!line.startsWith("data: ")) continue;
 *           const data = line.slice(6).trim();
 *           if (data === "[DONE]") continue;
 *           try {
 *             const json = JSON.parse(data);
 *             const text = json.choices?.[0]?.delta?.content;
 *             if (text) res.write("data: " + JSON.stringify({ type: "text", text, model: modelId }) + "\n\n");
 *           } catch {}
 *         }
 *       }
 *       res.write("data: " + JSON.stringify({ type: "done", model: modelId }) + "\n\n");
 *       res.end();
 *       return;
 *     } catch (e) { lastError = e; console.warn("[jimmy] model " + modelId + " failed: " + e.message); }
 *   }
 *   res.write("data: " + JSON.stringify({ type: "error", error: String(lastError) }) + "\n\n");
 *   res.end();
 * });
 * ──────────────────────────────────────────────────────────────────────────── */
