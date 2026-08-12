// ╔══════════════════════════════════════════════════════════════╗
// ║  NEXATECT™ — MASTER AI MODEL REGISTRY (LOCKED)               ║
// ║  Target: /opt/hostflowai-brain/backend/src/config/ai-models.ts║
// ║  Ek jagah update karo — sab jagah apply hoga                 ║
// ╚══════════════════════════════════════════════════════════════╝

// ─── API ENDPOINTS ───────────────────────────────────────────
export const ENDPOINTS = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  deepinfra: "https://api.deepinfra.com/v1/openai/chat/completions",
};

// ─── API KEYS (env se — server only) ─────────────────────────
export const KEYS = {
  or1: () => process.env.OPENROUTER_API_KEY_1 || "",
  or2: () => process.env.OPENROUTER_API_KEY_2 || "",
  or3: () => process.env.OPENROUTER_API_KEY_3 || "",
  di1: () => process.env.DEEPINFRA_API_KEY_1 || "",
  di2: () => process.env.DEEPINFRA_API_KEY_2 || "",
};

// ─── MODEL REGISTRY ───────────────────────────────────────────
export const MODELS = {
  // ── JIMMY (AXONETIS Builder — Awam) ──────────────────────
  jimmy: {
    primary: { model: "claude-sonnet-5", provider: "deepinfra", key: "di1" },
    code: { model: "Qwen/Qwen3-Coder-480B-A35B-Instruct", provider: "deepinfra", key: "di1" },
    reason: { model: "deepseek-ai/DeepSeek-R1-0528", provider: "deepinfra", key: "di1" },
    fallback: { model: "deepseek-ai/DeepSeek-V4-Flash", provider: "deepinfra", key: "di1" },
    free: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", provider: "deepinfra", key: "di1" },
  },

  // ── JIMMY FOUNDER (Nauman only) ───────────────────────────
  jimmy_founder: {
    primary: { model: "anthropic/claude-sonnet-5", provider: "openrouter", key: "or1" },
    fallback: { model: "anthropic/claude-sonnet-4-6", provider: "openrouter", key: "or1" },
  },

  // ── SHERLOCK ──────────────────────────────────────────────
  sherlock: {
    primary: { model: "deepseek-ai/DeepSeek-R1-0528", provider: "deepinfra", key: "di1" },
    fallback: { model: "deepseek-ai/DeepSeek-V4-Pro", provider: "deepinfra", key: "di1" },
  },

  // ── LEO (ANEXOMAIL) ───────────────────────────────────────
  leo: {
    primary: { model: "claude-haiku-4-5", provider: "deepinfra", key: "di2" },
    fallback: { model: "deepseek-ai/DeepSeek-V4-Flash", provider: "deepinfra", key: "di2" },
    free: {
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      provider: "deepinfra",
      key: "di2",
    },
  },

  // ── 8 INDUSTRY AIs ───────────────────────────────────────
  aria: {
    // Travel & Hospitality
    primary: { model: "google/gemini-2.5-flash", provider: "deepinfra", key: "di1" },
    deep: { model: "claude-sonnet-5", provider: "deepinfra", key: "di1" },
    vision: { model: "Qwen/Qwen3-VL-235B-A22B-Instruct", provider: "deepinfra", key: "di1" },
    fallback: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", provider: "deepinfra", key: "di1" },
  },
  orion: {
    // Airlines
    primary: { model: "google/gemini-2.5-flash", provider: "deepinfra", key: "di1" },
    fallback: { model: "deepseek-ai/DeepSeek-V4-Flash", provider: "deepinfra", key: "di1" },
  },
  rex: {
    // Car Rental
    primary: { model: "deepseek-ai/DeepSeek-V4-Pro", provider: "deepinfra", key: "di1" },
    fallback: { model: "deepseek-ai/DeepSeek-V4-Flash", provider: "deepinfra", key: "di1" },
  },
  lyra: {
    // Healthcare — SAFETY CRITICAL
    primary: { model: "claude-sonnet-5", provider: "deepinfra", key: "di1" },
    fallback: { model: "anthropic/claude-sonnet-4-6", provider: "openrouter", key: "or1" },
  },
  sage: {
    // Education
    primary: { model: "Qwen/Qwen3-235B-A22B-Instruct-2507", provider: "deepinfra", key: "di1" },
    fallback: { model: "deepseek-ai/DeepSeek-V4-Flash", provider: "deepinfra", key: "di1" },
  },
  atlas: {
    // Logistics
    primary: { model: "deepseek-ai/DeepSeek-V4-Pro", provider: "deepinfra", key: "di1" },
    fallback: { model: "deepseek-ai/DeepSeek-V4-Flash", provider: "deepinfra", key: "di1" },
  },
  vega: {
    // Events
    primary: { model: "google/gemini-2.5-flash", provider: "deepinfra", key: "di1" },
    fallback: { model: "deepseek-ai/DeepSeek-V4-Flash", provider: "deepinfra", key: "di1" },
  },
  kai: {
    // Railways
    primary: { model: "google/gemini-2.5-flash", provider: "deepinfra", key: "di1" },
    fallback: { model: "deepseek-ai/DeepSeek-V4-Flash", provider: "deepinfra", key: "di1" },
  },
};

// ─── CREDIT COSTS ─────────────────────────────────────────────
export const CREDITS = {
  standard: 0.5, // 2 requests = 1 credit
  advanced: 2, // complex tasks
  vision: 3, // image analysis
  bulk: 5, // batch operations
};

// ─── RATE LIMITS ──────────────────────────────────────────────
export const LIMITS = {
  free: { daily: 5, monthly: 50 },
  basic: { daily: 50, monthly: 1000 },
  pro: { daily: 200, monthly: 5000 },
  premium: { daily: -1, monthly: -1 }, // unlimited
  founder: { daily: -1, monthly: -1 }, // unlimited
};

// ─── HELPER: get endpoint + key ───────────────────────────────
export function getModelConfig(agent: keyof typeof MODELS, tier: string = "primary") {
  const agentModels = MODELS[agent] as any;
  const config = agentModels?.[tier] || agentModels?.primary;
  if (!config) throw new Error(`Model not found: ${agent}.${tier}`);
  const endpoint = ENDPOINTS[config.provider as keyof typeof ENDPOINTS];
  const apiKey = KEYS[config.key as keyof typeof KEYS]();
  return { model: config.model, endpoint, apiKey, provider: config.provider };
}

export default MODELS;
