/**
 * Phase 3.9.6 + 3.9.7 — additions to /var/www/NEXATECT-Engine/server/routes/rpc.routes.ts
 *
 * APPEND/register these handlers on the existing /rpc router (NO duplicate router).
 * IMPORTANT: paths below are WITHOUT `/rpc` because rpc.routes.ts is mounted as app.use("/rpc", router).
 *
 * Deps:
 *   supabase3 = createClient(SUPABASE3_URL, SUPABASE3_SERVICE_ROLE_KEY)   // already exists
 *   MODEL_PRICING map (input/output $ per 1M tokens) — see bottom of this file.
 */

import type { Request, Response, Router } from "express";

// ─── Global Router model table (Phase 3.9.7) ─────────────────────────────────
// Keep in sync with mem://features/ai-models — 6 approved OpenRouter/Groq models.
const MODEL_PRICING: Record<string, { in: number; out: number; tier: string[] }> = {
  // $ per 1M tokens
  "qwen/qwen-2.5-coder-32b":               { in: 0.18, out: 0.18, tier: ["build", "classify"] },
  "meta-llama/llama-3.3-70b-instruct":     { in: 0.23, out: 0.40, tier: ["build", "reason"] },
  "google/gemini-2.0-flash-exp:free":      { in: 0.00, out: 0.00, tier: ["classify"] },
  "deepseek/deepseek-r1":                  { in: 0.55, out: 2.19, tier: ["audit", "reason"] },
  "anthropic/claude-3.5-sonnet":           { in: 3.00, out: 15.00, tier: ["audit", "reason"] },
  "openai/gpt-4o-mini":                    { in: 0.15, out: 0.60, tier: ["classify", "build"] },
};

const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet"; // baseline for savings math

function estimateTokens(prompt: string): { input: number; output: number } {
  // Cheap heuristic: 1 token ≈ 4 chars. Output budgeted at 1.5× input.
  const input = Math.max(64, Math.ceil(prompt.length / 4));
  const output = Math.ceil(input * 1.5);
  return { input, output };
}

function costOf(model: string, tokens: { input: number; output: number }): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  return (tokens.input * p.in + tokens.output * p.out) / 1_000_000;
}

function classifyTier(prompt: string, agent: "jimmy" | "sherlock"): "classify" | "build" | "audit" | "reason" {
  const p = prompt.toLowerCase();
  if (agent === "sherlock") return /deep|why|explain|architect/.test(p) ? "reason" : "audit";
  if (/refactor|redesign|architect|migrate/.test(p)) return "reason";
  if (/rename|typo|format|classify|list/.test(p)) return "classify";
  return "build";
}

export function registerRouterAndMarketplaceRoutes(router: Router, supabase3: any /* SupabaseClient */) {

  // ── POST /rpc/router.preview ────────────────────────────────────────────
  router.post("/router.preview", async (req: Request, res: Response) => {
    try {
      const { prompt, agent } = req.body ?? {};
      if (typeof prompt !== "string" || !prompt.trim() || (agent !== "jimmy" && agent !== "sherlock")) {
        return res.status(400).json({ error: "bad_input" });
      }
      const tier = classifyTier(prompt, agent);
      const tokens = estimateTokens(prompt);

      // Pick cheapest model that supports this tier.
      const candidates = Object.entries(MODEL_PRICING)
        .filter(([, v]) => v.tier.includes(tier))
        .map(([m]) => ({ model: m, cost: costOf(m, tokens) }))
        .sort((a, b) => a.cost - b.cost);

      const chosen = candidates[0]?.model ?? DEFAULT_MODEL;
      const chosenCost = costOf(chosen, tokens);
      const defaultCost = costOf(DEFAULT_MODEL, tokens);

      return res.json({
        model: chosen,
        default_model: DEFAULT_MODEL,
        est_cost_usd: Number(chosenCost.toFixed(6)),
        est_saved_usd: Number(Math.max(0, defaultCost - chosenCost).toFixed(6)),
        reason: `${tier}-tier · cheapest of ${candidates.length} candidates`,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "router_error" });
    }
  });

  // Call this from the agent worker AFTER a completion, to persist the decision
  // and stamp cost fields on the assistant row. Export as helper too.
  async function logRouterDecision(input: {
    thread_id?: string;
    message_id?: string;
    project_id?: string;
    agent_slug: string;
    chosen_model: string;
    default_model?: string;
    tier?: string;
    input_tokens: number;
    output_tokens: number;
    reason?: string;
  }) {
    const tokens = { input: input.input_tokens, output: input.output_tokens };
    const chosen_cost_usd = costOf(input.chosen_model, tokens);
    const default_cost_usd = costOf(input.default_model ?? DEFAULT_MODEL, tokens);
    await supabase3.from("router_decisions").insert({
      thread_id: input.thread_id,
      message_id: input.message_id,
      project_id: input.project_id,
      agent_slug: input.agent_slug,
      chosen_model: input.chosen_model,
      default_model: input.default_model ?? DEFAULT_MODEL,
      tier: input.tier,
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      chosen_cost_usd,
      default_cost_usd,
      reason: input.reason,
    });
    if (input.message_id) {
      await supabase3.from("agent_thread_messages").update({
        cost_usd: chosen_cost_usd,
        saved_vs_default_usd: Math.max(0, default_cost_usd - chosen_cost_usd),
        default_model: input.default_model ?? DEFAULT_MODEL,
      }).eq("id", input.message_id);
    }
  }
  (router as any).logRouterDecision = logRouterDecision;

  // ── GET /rpc/marketplace.list ───────────────────────────────────────────
  router.get("/marketplace.list", async (_req, res) => {
    const { data, error } = await supabase3
      .from("marketplace_agents")
      .select("*")
      .order("featured", { ascending: false })
      .order("installs", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ agents: data ?? [] });
  });

  // ── GET /rpc/marketplace.installed?projectId=... ────────────────────────
  router.get("/marketplace.installed", async (req, res) => {
    const projectId = String(req.query.projectId ?? "");
    if (!projectId) return res.status(400).json({ error: "projectId required" });
    const { data, error } = await supabase3
      .from("marketplace_installs")
      .select("agent_slug, version, installed_at, enabled")
      .eq("project_id", projectId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({
      installed: (data ?? []).map((r: any) => ({
        slug: r.agent_slug,
        version: r.version,
        installed_at: r.installed_at,
        enabled: r.enabled,
      })),
    });
  });

  // ── POST /rpc/marketplace.install  { projectId, slug } ──────────────────
  router.post("/marketplace.install", async (req, res) => {
    const { projectId, slug } = req.body ?? {};
    if (!projectId || !slug) return res.status(400).json({ error: "projectId + slug required" });

    const { data: agent, error: agentErr } = await supabase3
      .from("marketplace_agents")
      .select("version")
      .eq("slug", slug)
      .maybeSingle();
    if (agentErr || !agent) return res.status(404).json({ error: "agent not found" });

    const { error } = await supabase3
      .from("marketplace_installs")
      .upsert({ project_id: projectId, agent_slug: slug, version: agent.version, enabled: true });
    if (error) return res.status(500).json({ error: error.message });

    await supabase3.rpc("increment_marketplace_installs", { p_slug: slug }).catch(() => null);

    return res.json({ ok: true });
  });

  // ── POST /rpc/marketplace.uninstall  { projectId, slug } ────────────────
  router.post("/marketplace.uninstall", async (req, res) => {
    const { projectId, slug } = req.body ?? {};
    if (!projectId || !slug) return res.status(400).json({ error: "projectId + slug required" });
    const { error } = await supabase3
      .from("marketplace_installs")
      .delete()
      .eq("project_id", projectId)
      .eq("agent_slug", slug);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  });
}

/*
Integration in main rpc.routes.ts:

  import { registerRouterAndMarketplaceRoutes } from "./rpc-phase-396-397.additions";
  registerRouterAndMarketplaceRoutes(router, supabase3);

Then in the agent worker, after streamText finishes:

  await (router as any).logRouterDecision({
    thread_id, message_id, project_id, agent_slug,
    chosen_model, default_model: "anthropic/claude-3.5-sonnet",
    tier, input_tokens, output_tokens, reason,
  });

That single call stamps cost_usd + saved_vs_default_usd on the assistant row
so the frontend badges light up automatically via Realtime.
*/
