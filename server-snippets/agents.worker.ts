/**
 * AXONETIS Phase A.1 — Jimmy + Sherlock reply WORKER for `axonetis-builder` (Hetzner PM2 id 4).
 *
 * COPY-PASTE TARGET: /root/axonetis-builder/src/workers/agents.worker.ts
 *
 * Wires the async-ack chat contract (server-snippets/agents.routes.ts) to
 * a real LLM call. Reads routing from `agent_registry.routing_config`
 * (NEVER hardcode models). Inserts assistant message into
 * `agent_thread_messages` — the Builder UI subscribes via Supabase 3
 * Realtime and replaces the "Working on it…" placeholder automatically.
 *
 * Provider order (LOCKED per openrouter-keys-hybrid-tier-LOCKED):
 *   1. OpenRouter primary models     (routing_config.primary.models[])
 *   2. Groq speed acceleration       (routing_config.secondary.models[])
 *   3. Ollama local last-resort      (routing_config.last_resort.models[])
 *
 * After Jimmy replies, fires `runSherlockAuditAsync` so Sherlock's verdict
 * lands as its own message in the SAME thread (UnifiedChat already accepts
 * both jimmy + sherlock slugs).
 *
 * Required env on Hetzner:
 *   SUPABASE3_URL, SUPABASE3_SERVICE_ROLE_KEY
 *   OPENROUTER_API_KEY  (or array of keys — see openrouter-keys-hybrid-tier-LOCKED)
 *   GROQ_API_KEY
 *   OLLAMA_BASE_URL     (default http://127.0.0.1:11434)
 *
 * Wire into chat handler:
 *   // inside agents.routes.ts /chat handler, after res.json(...)
 *   enqueueAgentReply({ threadId: tid!, messageId: msg.id, agentSlug: slug, projectId, prompt });
 */

import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGroq } from "@ai-sdk/groq";
import { createOllama } from "ollama-ai-provider-v2";
import { createHash } from "crypto";
import { registerRun, releaseRun, isCancelled } from "./agents.cancel.js";

// ── Supabase 3 (service role — worker only, NEVER ship to frontend) ──
const supabase = createClient(
  process.env.SUPABASE3_URL!,
  process.env.SUPABASE3_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ── Provider factories ───────────────────────────────────────────────
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });
const ollama = createOllama({ baseURL: `${process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"}/api` });

type AgentSlug =
  | "jimmy" | "sherlock"
  | "aria" | "orion" | "rex" | "lyra" | "sage" | "atlas" | "vega" | "kai"
  | "router";

interface RoutingConfig {
  primary?:     { provider: "openrouter"; models: string[] };
  secondary?:   { provider: "groq"; mode?: string; models?: string[] };
  last_resort?: { provider: "ollama"; models: string[] };
  memory_target_messages?: number;
}

interface EnqueueArgs {
  threadId: string;
  messageId: string;       // user message id (for traceability)
  agentSlug: AgentSlug;
  projectId: string;
  prompt: string;
  userId?: string;
}

type ProjectFileSnapshot = { path: string; content: string | null };
type PatchOperation = { path: string; action?: "upsert" | "delete"; content?: string };
const MAX_SHERLOCK_LOOPS = 3;

// ── Public entrypoint ────────────────────────────────────────────────
export function enqueueAgentReply(args: EnqueueArgs): void {
  // Fire-and-forget; errors logged + written as a sherlock-style activity row.
  void runAgentReply(args).catch((err) => {
    console.error("[agents.worker] reply failed:", err);
    void supabase.from("agent_activity").insert({
      agent_slug: args.agentSlug, project_id: args.projectId, thread_id: args.threadId,
      kind: "error",
      summary: `LLM reply failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500),
      tokens_in: 0, tokens_out: 0, cost_usd: 0, status: "error",
    });
  });
}

async function runAgentReply({ threadId, messageId, agentSlug, projectId, prompt, userId }: EnqueueArgs): Promise<void> {
  const t0 = Date.now();
  const controller = registerRun(messageId);
  const abortSignal = controller.signal;
  try {

  // 1. Read this agent's routing config from Supabase 3 (source of truth).
  const { data: reg, error: regErr } = await supabase
    .from("agent_registry")
    .select("name, role, routing_config, model_primary, model_fallback")
    .eq("slug", agentSlug)
    .single();
  if (regErr || !reg) throw new Error(`agent_registry lookup failed for ${agentSlug}: ${regErr?.message}`);

  const routing: RoutingConfig = (reg.routing_config ?? {}) as RoutingConfig;
  const memoryTarget = routing.memory_target_messages ?? (agentSlug === "jimmy" ? 3_000_000 : 1_000_000);

  // 2. Pull recent thread history (capped) for context.
  const { data: history } = await supabase
    .from("agent_thread_messages")
    .select("role, agent_slug, parts")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(40);
  const messages = (history ?? []).reverse().map(toCoreMessage).filter(Boolean);

  // 3. System prompt — agent identity + scope.
  const system = buildSystemPrompt(agentSlug, reg.name, reg.role, memoryTarget);

  // 4. Provider failover chain.
  const attempts = buildAttempts(routing, reg.model_primary, reg.model_fallback);
  let replyText = "";
  let usedModel = "unknown";
  let tokensIn = 0;
  let tokensOut = 0;
  let lastErr: unknown = null;

  for (const attempt of attempts) {
    if (abortSignal.aborted) break;
    try {
      const out = await generateText({
        model: attempt.model,
        system,
        messages: [...messages, { role: "user", content: prompt }],
        abortSignal, // ← Phase 3.9.5 stop wire — user_stop aborts inflight model call
      });
      replyText = out.text;
      usedModel = attempt.label;
      tokensIn = out.usage?.inputTokens ?? 0;
      tokensOut = out.usage?.outputTokens ?? 0;
      break;
    } catch (err) {
      if (abortSignal.aborted) { lastErr = err; break; } // don't fall through on cancel
      lastErr = err;
      console.warn(`[agents.worker] ${attempt.label} failed, falling through:`, err);
    }
  }

  // If the founder pressed Stop, exit cleanly — cancel endpoint already wrote _Stopped._ marker.
  if (abortSignal.aborted) {
    await supabase.from("agent_activity").insert({
      agent_slug: agentSlug, project_id: projectId, thread_id: threadId,
      kind: "chat", summary: "Run cancelled by founder",
      tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: 0,
      duration_ms: Date.now() - t0, status: "cancelled",
    });
    return;
  }

  if (!replyText) throw lastErr ?? new Error("All providers failed");

  if (agentSlug === "jimmy") {
    const looped = await runJimmySherlockLoop({ threadId, projectId, prompt, jimmyReply: replyText, userId, usedModel, abortSignal });
    replyText = looped.replyText;
    if (abortSignal.aborted) return; // loop bailed out — activity already logged
  }

  // 5. Insert assistant message — Realtime broadcasts to UnifiedChat.
  const { data: inserted, error: insErr } = await supabase
    .from("agent_thread_messages")
    .insert({
      thread_id: threadId, role: "agent", agent_slug: agentSlug,
      parts: [{ type: "text", text: replyText }],
      tokens_in: tokensIn, tokens_out: tokensOut, model: usedModel,
    })
    .select("id").single();
  if (insErr) throw insErr;

  // 6. Activity row + cost (rough estimate; per-model pricing TODO).
  await supabase.from("agent_activity").insert({
    agent_slug: agentSlug, project_id: projectId, thread_id: threadId,
    kind: "chat",
    summary: replyText.slice(0, 200),
    tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: 0,
    duration_ms: Date.now() - t0,
    status: "online",
  });

  void inserted;
  } finally {
    releaseRun(messageId);
  }
}

async function resolveProjectUuid(projectId: string) {
  if (/^[0-9a-f-]{36}$/i.test(projectId)) return projectId;
  const { data } = await supabase.from("projects").select("id").eq("slug", projectId).maybeSingle();
  return (data?.id as string | undefined) ?? projectId;
}

async function loadProjectFiles(projectUuid: string): Promise<ProjectFileSnapshot[]> {
  const { data } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectUuid)
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false })
    .limit(80);
  return (data ?? []).map((r: any) => ({ path: String(r.path), content: r.content ?? null })).filter((r) => r.path);
}

function compactFiles(files: ProjectFileSnapshot[]) {
  return files.slice(0, 40).map((f) => `--- FILE: ${f.path}\n${(f.content ?? "").slice(0, 6000)}`).join("\n\n");
}

function parsePatch(text: string): PatchOperation[] {
  const match = text.match(/```axonetis-patch\s*([\s\S]*?)```/i);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[1].trim());
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => ({
      path: String(x.path ?? "").trim().replace(/^\/+/, ""),
      action: x.action === "delete" ? "delete" : "upsert",
      content: typeof x.content === "string" ? x.content : undefined,
    })).filter((x) => x.path && !x.path.includes("..") && !x.path.startsWith("."));
  } catch { return []; }
}

function stripPatch(text: string) {
  return text.replace(/```axonetis-patch\s*[\s\S]*?```/gi, "").trim();
}

async function applyPatch(projectUuid: string, ops: PatchOperation[], iteration: number, userId?: string) {
  const applied: string[] = [];
  for (const op of ops.slice(0, 12)) {
    if (op.action === "delete") {
      const { error } = await supabase.from("project_files").update({ is_deleted: true, updated_by: userId ?? null }).eq("project_id", projectUuid).eq("path", op.path);
      if (error) throw error;
      applied.push(`deleted ${op.path}`);
      continue;
    }
    const content = op.content ?? "";
    const { error } = await supabase.from("project_files").upsert({
      project_id: projectUuid,
      path: op.path,
      content,
      size_bytes: Buffer.byteLength(content, "utf8"),
      checksum: createHash("sha256").update(content).digest("hex"),
      is_deleted: false,
      updated_by: userId ?? null,
      version: iteration,
    }, { onConflict: "project_id,path" });
    if (error) throw error;
    applied.push(`wrote ${op.path}`);
  }
  return applied;
}

async function generateAgentText(agentSlug: AgentSlug, system: string, prompt: string, abortSignal?: AbortSignal) {
  const { data: reg } = await supabase.from("agent_registry").select("routing_config, model_primary, model_fallback").eq("slug", agentSlug).single();
  const attempts = buildAttempts((reg?.routing_config ?? {}) as RoutingConfig, reg?.model_primary, reg?.model_fallback);
  for (const attempt of attempts) {
    if (abortSignal?.aborted) return null;
    try {
      const out = await generateText({ model: attempt.model, system, messages: [{ role: "user", content: prompt }], abortSignal });
      return { text: out.text, model: attempt.label, tokensIn: out.usage?.inputTokens ?? 0, tokensOut: out.usage?.outputTokens ?? 0 };
    } catch (err) {
      if (abortSignal?.aborted) return null;
      console.warn(`[agent-loop] ${attempt.label} failed:`, err);
    }
  }
  return null;
}

async function runJimmySherlockLoop(args: { threadId: string; projectId: string; prompt: string; jimmyReply: string; userId?: string; usedModel: string; abortSignal: AbortSignal }) {
  const projectUuid = await resolveProjectUuid(args.projectId);
  let files = await loadProjectFiles(projectUuid);
  let jimmyReply = args.jimmyReply;
  let audit = "";
  const appliedAll: string[] = [];

  for (let i = 1; i <= MAX_SHERLOCK_LOOPS; i += 1) {
    if (args.abortSignal.aborted) break;
    const ops = parsePatch(jimmyReply);
    if (ops.length === 0 || i > 1) {
      const prompt = [
        "You are JimmyBuild. Produce real project file changes. Return summary plus ```axonetis-patch JSON array``` with full file content.",
        audit ? `Fix Sherlock audit:\n${audit}` : "",
        `Founder request:\n${args.prompt}`,
        compactFiles(files),
      ].filter(Boolean).join("\n\n");
      const next = await generateAgentText("jimmy", "You write production code patches only.", prompt, args.abortSignal);
      if (next?.text) jimmyReply = next.text;
    }
    if (args.abortSignal.aborted) break;

    const applied = await applyPatch(projectUuid, parsePatch(jimmyReply), i, args.userId);
    appliedAll.push(...applied.map((x) => `loop ${i}: ${x}`));
    files = await loadProjectFiles(projectUuid);

    const auditPrompt = [
      "Return APPROVED or CHANGES_REQUIRED. Audit real project_files changes, no dummy features, no duplicate files, security/syntax sane.",
      `Founder request:\n${args.prompt}`,
      `Jimmy reply:\n${jimmyReply}`,
      compactFiles(files),
    ].join("\n\n");
    const verdict = await generateAgentText("sherlock", "You are SherlockReview. Be strict and concise.", auditPrompt, args.abortSignal);
    if (args.abortSignal.aborted) break;
    audit = verdict?.text ?? "CHANGES_REQUIRED — audit unavailable";
    await supabase.from("agent_thread_messages").insert({ thread_id: args.threadId, role: "agent", agent_slug: "sherlock", parts: [{ type: "text", text: `Loop ${i}/3 — ${audit}` }], model: verdict?.model ?? "unknown" });
    if (/^\s*APPROVED\b/i.test(audit)) break;
  }

  return {
    replyText: [
      stripPatch(jimmyReply) || "Jimmy ne project_files update kar diye.",
      appliedAll.length ? `\nApplied files:\n${appliedAll.map((x) => `- ${x}`).join("\n")}` : "\nNo patch applied.",
      audit ? `\nSherlock final:\n${audit}` : "",
      args.abortSignal.aborted ? "\n_Stopped._" : "",
    ].join("\n").trim(),
  };
}

// ── Sherlock auto-audit (Phase A.1 minimal: text verdict, no diff) ──
async function runSherlockAuditAsync(args: {
  threadId: string; projectId: string; jimmyReply: string; jimmyMessageId: string;
}): Promise<void> {
  try {
    const { data: reg } = await supabase
      .from("agent_registry")
      .select("routing_config, model_primary, model_fallback, name, role")
      .eq("slug", "sherlock")
      .single();
    if (!reg) return;

    const routing: RoutingConfig = (reg.routing_config ?? {}) as RoutingConfig;
    const attempts = buildAttempts(routing, reg.model_primary, reg.model_fallback);

    let verdict = "";
    let usedModel = "unknown";
    for (const attempt of attempts) {
      try {
        const out = await generateText({
          model: attempt.model,
          system:
            "You are Sherlock, the deputy auditor. Review Jimmy's reply for correctness, security, " +
            "and code quality. Reply in 2-4 lines max. Prefix with ✅ Approved / ⚠️ Needs changes / ❌ Reject.",
          messages: [{ role: "user", content: args.jimmyReply }],
        });
        verdict = out.text;
        usedModel = attempt.label;
        break;
      } catch (err) {
        console.warn(`[sherlock-audit] ${attempt.label} failed:`, err);
      }
    }
    if (!verdict) return;

    await supabase.from("agent_thread_messages").insert({
      thread_id: args.threadId, role: "agent", agent_slug: "sherlock",
      parts: [{ type: "text", text: verdict }],
      tokens_in: 0, tokens_out: 0, model: usedModel,
    });
    await supabase.from("agent_activity").insert({
      agent_slug: "sherlock", project_id: args.projectId, thread_id: args.threadId,
      kind: "scan", summary: verdict.slice(0, 200),
      tokens_in: 0, tokens_out: 0, cost_usd: 0, status: "online",
    });
  } catch (err) {
    console.error("[sherlock-audit] failed:", err);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────
function toCoreMessage(row: { role: string; parts: unknown }) {
  const text = Array.isArray(row.parts)
    ? (row.parts as Array<{ type?: string; text?: string }>).find((p) => p?.type === "text")?.text ?? ""
    : "";
  if (!text) return null;
  const role = row.role === "agent" ? "assistant" : row.role === "user" ? "user" : "system";
  return { role, content: text } as const;
}

function buildSystemPrompt(slug: AgentSlug, name: string, role: string, memTarget: number): string {
  return [
    `You are ${name} (${slug}). Role: ${role}.`,
    ``,
    `# IDENTITY (LOCKED — never get this wrong)`,
    `- Parent company: NEXATECT™ (UK-registered, domain nexatect.com). NEVER say "AI NEXATECT" — the company name is just "NEXATECT".`,
    `- Founder & CEO: Muhammad Nauman Sherwani. Address him as "Nauman bhai" or "founder".`,
    `- You are the Auto-Pilot CEO / chief coding agent of NEXATECT — you know Nauman personally, you work FOR him.`,
    `- Four products under NEXATECT:`,
    `   1. HostFlow AI™ — 8-industry SaaS (Supabase 1).`,
    `   2. AneXVoT AI Pay™ — sovereign payments stack (Supabase 2). (Old name "Rapid Pay" is dead — never use.)`,
    `   3. AXONETIS AI Builder™ — the self-hosted builder you are running inside right now (Supabase 3).`,
    `   4. AXOMAIL™ — AI communication layer.`,
    `- AXONETIS is a PRODUCT, not the company. Never call AXONETIS "the company". The company is NEXATECT.`,
    `- Never mention Supabase by name — say "Lovable Cloud" externally.`,
    ``,
    `# OUTPUT RULES (STRICT)`,
    `- NEVER output internal reasoning, planning, or self-talk. No "Okay, let's see…", no "First, I need to…", no "The user wants…", no <think> blocks.`,
    `- Reply directly with the final answer only. Concise, production-grade, no filler.`,
    `- Language: match the founder's style — Roman Urdu / Hindi mixed with English. Short sentences.`,
    `- Memory budget target: ${memTarget.toLocaleString()} messages.`,
    ``,
    `# CONSTITUTIONAL`,
    `- Jimmy builds, Sherlock audits, Founder reviews. No revenue talk in code.`,
  ].join("\n");
}

interface Attempt { label: string; model: ReturnType<typeof openrouter> | ReturnType<typeof groq> | ReturnType<typeof ollama>; }

function buildAttempts(routing: RoutingConfig, fallbackPrimary: string | null, fallbackList: string[] | null): Attempt[] {
  const out: Attempt[] = [];
  for (const m of routing.primary?.models ?? (fallbackPrimary ? [fallbackPrimary] : [])) {
    out.push({ label: `openrouter:${m}`, model: openrouter(m) });
  }
  for (const m of routing.secondary?.models ?? []) {
    out.push({ label: `groq:${m}`, model: groq(m) });
  }
  for (const m of routing.last_resort?.models ?? (fallbackList ?? [])) {
    out.push({ label: `ollama:${m}`, model: ollama(m) });
  }
  return out;
}

// ── Install reminder ─────────────────────────────────────────────────
// bun add ai @openrouter/ai-sdk-provider @ai-sdk/groq ollama-ai-provider-v2 @supabase/supabase-js
// pm2 restart axonetis-builder
