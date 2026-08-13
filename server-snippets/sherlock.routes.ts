// ╔════════════════════════════════════════════════════════════════╗
// ║  NEXATECT™ — Sherlock brain routes (FIXED for AI SDK v4+)    ║
// ║  Target: /opt/hostflowai-brain/backend/src/routes/founder/sherlock.ts
// ║  Mount:  app.use("/api/founder", sherlockRouter)  → /api/founder/sherlock/audit
// ║                                                                    ║
// ║  FIX: Vercel AI SDK v4 mein `messages` array mein                 ║
// ║  { role: "system", content: "..." } allowed NAHI hai.               ║
// ║  System prompt ko `system:` parameter mein alag se pass karo.     ║
// ╚════════════════════════════════════════════════════════════════╝
import { Router } from "express";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getModelConfig } from "../../config/ai-models.js";

const router = Router();

const deepinfra = createOpenAI({
  baseURL: "https://api.deepinfra.com/v1/openai",
  apiKey: process.env.DEEPINFRA_API_KEY_1!,
});

// Sherlock model chain — DeepInfra DI1 only
const SHERLOCK_CHAIN = ["primary", "fallback"] as const;

const SHERLOCK_SYSTEM = (projectId: string) =>
  `Tu SHERLOCK hai — NEXATECT ka Chief Audit & Security Officer.

FOUNDER COMMUNICATION CONTRACT — STRICT:
- Founder se natural Roman Urdu/Hindi mein baat kar; sirf zaroori technical terms English mein rakh.
- Seedha answer ya action se shuru kar. Generic greeting, corporate pitch, repeated offer-to-help kabhi mat likh.
- Final answer only. Internal reasoning, self-talk, "let me think", hidden planning output mat dikha.
- Jo actually verify hua ho sirf wohi complete bol. Pending ko pending bol. Fake success mana hai.
- Commands, paths, errors aur code identifiers exact rakho. Markdown clean rakh.
- Yeh founder workspace hai, customer-support chat nahi.

AUDIT CONTRACT:
- Har file, route, SQL, ya config ko security, correctness, duplication, aur NEXATECT rules ke lens se check kar.
- CRITICAL issue milne par turant halt + reason batao. Masking / chhupana mana hai.
- Jimmy ne jo likha hai usi ko audit kar; doosri jagah se assume mat kar.
- Project ID: ${projectId}`;

function normalizeMessages(messages: unknown) {
  if (!Array.isArray(messages)) return [];
  return messages.filter((message) => {
    if (!message || typeof message !== "object") return false;
    const role = (message as { role?: unknown }).role;
    // ❌ system messages yahan se hatao — unko `system:` parameter mein bhejo
    return role === "user" || role === "assistant";
  });
}

function violatesFounderVoice(text: string) {
  return /\bhi there\b|\bsherlock here\b|\bready to help\b|\bwhat can i (?:assist|help)\b|\bhow can i (?:assist|help)\b|ready ho ja(?:o|ye)|kya aap kuch specific verify|agla step bata(?:o|ayein)/i.test(text);
}

// POST /api/founder/sherlock/audit — SSE streaming audit
router.post("/sherlock/audit", async (req, res) => {
  const { messages, projectId } = req.body ?? {};
  if (!messages || !projectId) {
    return res.status(400).json({ error: "messages + projectId required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let lastError: any = null;

  for (const tier of SHERLOCK_CHAIN) {
    try {
      const { model: modelId } = getModelConfig("sherlock", tier);
      const result = streamText({
        model: deepinfra(modelId),
        // ✅ FIX: system prompt `messages` array mein nahi, `system:` parameter mein
        system: SHERLOCK_SYSTEM(projectId),
        messages: normalizeMessages(messages),
        maxSteps: 50,
      });

      let fullText = "";
      for await (const chunk of result.textStream) {
        fullText += chunk;
        res.write(`data: ${JSON.stringify({ type: "text", text: chunk, model: modelId, tier }) }\n\n`);
      }
      if (violatesFounderVoice(fullText)) {
        throw new Error("Founder communication contract violated");
      }
      res.write(`data: ${JSON.stringify({ type: "done", model: modelId, tier })}\n\n`);
      res.end();
      return;
    } catch (modelErr: any) {
      lastError = modelErr;
      console.warn(`[sherlock] tier ${tier} failed: ${modelErr?.message}`);
    }
  }

  res.write(
    `data: ${JSON.stringify({ type: "error", error: lastError?.message ?? "All Sherlock tiers failed" })}\n\n`,
  );
  res.end();
});

// Backwards-compat alias — /sherlock/stream bhi audit hi chalayega
router.post("/sherlock/stream", async (req, res) => {
  // Forward same request body to /sherlock/audit logic
  const { messages, projectId } = req.body ?? {};
  if (!messages || !projectId) {
    return res.status(400).json({ error: "messages + projectId required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let lastError: any = null;
  for (const tier of SHERLOCK_CHAIN) {
    try {
      const { model: modelId } = getModelConfig("sherlock", tier);
      const result = streamText({
        model: deepinfra(modelId),
        system: SHERLOCK_SYSTEM(projectId),
        messages: normalizeMessages(messages),
        maxSteps: 50,
      });
      for await (const chunk of result.textStream) {
        res.write(`data: ${JSON.stringify({ type: "text", text: chunk, model: modelId, tier })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: "done", model: modelId, tier })}\n\n`);
      res.end();
      return;
    } catch (modelErr: any) {
      lastError = modelErr;
      console.warn(`[sherlock] tier ${tier} failed: ${modelErr?.message}`);
    }
  }
  res.write(`data: ${JSON.stringify({ type: "error", error: lastError?.message ?? "All Sherlock tiers failed" })}\n\n`);
  res.end();
});

export default router;
