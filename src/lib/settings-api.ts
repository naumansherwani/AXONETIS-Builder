/**
 * PHASE 12.1 — SETTINGS PANEL API.
 * Reads/writes founder settings on Supabase 3 (self-hosted):
 *   - founder_settings  (single row, key = 'founder')
 *   - ai_model_registry (dropdown source per agent role)
 *   - ai_agent_identities (per-agent default model → written back)
 * Zero dummy data: if a table is empty the UI shows an empty state.
 */
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

export type ThemeMode = "dark" | "light" | "system";
export type NotifyMode = "email" | "in-app" | "none";

export interface ModelOption {
  model_key: string;
  display_name: string;
  provider: string;
  role: string;
  tier: string | null;
  is_active: boolean;
}

export interface AgentIdentity {
  identity_key: string;
  display_name: string;
  role: string;
  default_model_key: string;
}

export interface FounderSettings {
  memory_limit_mb: number;
  cost_daily_usd: number;
  cost_weekly_usd: number;
  cost_monthly_usd: number;
  notify_mode: NotifyMode;
  theme: ThemeMode;
}

export const DEFAULT_SETTINGS: FounderSettings = {
  memory_limit_mb: 512,
  cost_daily_usd: 25,
  cost_weekly_usd: 120,
  cost_monthly_usd: 400,
  notify_mode: "in-app",
  theme: "dark",
};

export interface SettingsSnapshot {
  settings: FounderSettings;
  models: ModelOption[];
  agents: AgentIdentity[];
  live: boolean;
  error?: string;
}

const SETTINGS_KEY = "founder";
const LOCAL_KEY = "fb.settings.v1";

function clampSettings(row: Record<string, unknown>): FounderSettings {
  const notify = String(row.notify_mode ?? DEFAULT_SETTINGS.notify_mode) as NotifyMode;
  const theme = String(row.theme ?? DEFAULT_SETTINGS.theme) as ThemeMode;
  return {
    memory_limit_mb: Number(row.memory_limit_mb ?? DEFAULT_SETTINGS.memory_limit_mb),
    cost_daily_usd: Number(row.cost_daily_usd ?? DEFAULT_SETTINGS.cost_daily_usd),
    cost_weekly_usd: Number(row.cost_weekly_usd ?? DEFAULT_SETTINGS.cost_weekly_usd),
    cost_monthly_usd: Number(row.cost_monthly_usd ?? DEFAULT_SETTINGS.cost_monthly_usd),
    notify_mode: (["email", "in-app", "none"] as NotifyMode[]).includes(notify)
      ? notify
      : DEFAULT_SETTINGS.notify_mode,
    theme: (["dark", "light", "system"] as ThemeMode[]).includes(theme)
      ? theme
      : DEFAULT_SETTINGS.theme,
  };
}

/** Local mirror so the panel + theme survive a reload even before Supabase 3 answers. */
export function readLocalSettings(): FounderSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? clampSettings(JSON.parse(raw) as Record<string, unknown>) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeLocalSettings(s: FounderSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  } catch {
    /* storage disabled — Supabase 3 remains the source of truth */
  }
}

export async function fetchSettings(): Promise<SettingsSnapshot> {
  const local = readLocalSettings();
  if (!SUPABASE3_READY)
    return {
      settings: local,
      models: [],
      agents: [],
      live: false,
      error: "Supabase 3 not configured",
    };

  const [settingsRes, modelsRes, agentsRes] = await Promise.all([
    supabase3.from("founder_settings").select("*").eq("key", SETTINGS_KEY).maybeSingle(),
    supabase3
      .from("ai_model_registry")
      .select("model_key,display_name,provider,role,tier,is_active")
      .order("role", { ascending: true })
      .order("priority", { ascending: true }),
    supabase3
      .from("ai_agent_identities")
      .select("identity_key,display_name,role,default_model_key")
      .eq("is_active", true)
      .order("priority", { ascending: true }),
  ]);

  const error = settingsRes.error?.message ?? modelsRes.error?.message ?? agentsRes.error?.message;

  const settings = settingsRes.data
    ? clampSettings(settingsRes.data as Record<string, unknown>)
    : local;
  writeLocalSettings(settings);

  return {
    settings,
    models: ((modelsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      model_key: String(r.model_key),
      display_name: String(r.display_name ?? r.model_key),
      provider: String(r.provider ?? "—"),
      role: String(r.role ?? "—"),
      tier: (r.tier as string | null) ?? null,
      is_active: Boolean(r.is_active ?? true),
    })),
    agents: ((agentsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      identity_key: String(r.identity_key),
      display_name: String(r.display_name ?? r.identity_key),
      role: String(r.role ?? "—"),
      default_model_key: String(r.default_model_key ?? ""),
    })),
    live: !error,
    error,
  };
}

export async function saveSettings(
  patch: Partial<FounderSettings>,
): Promise<{ ok: boolean; settings: FounderSettings; error?: string }> {
  const next = clampSettings({ ...readLocalSettings(), ...patch } as Record<string, unknown>);
  writeLocalSettings(next);
  if (!SUPABASE3_READY) return { ok: false, settings: next, error: "Supabase 3 not configured" };
  const { error } = await supabase3
    .from("founder_settings")
    .upsert({ key: SETTINGS_KEY, ...next, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return error ? { ok: false, settings: next, error: error.message } : { ok: true, settings: next };
}

export async function setAgentModel(
  identityKey: string,
  modelKey: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE3_READY) return { ok: false, error: "Supabase 3 not configured" };
  const { error } = await supabase3
    .from("ai_agent_identities")
    .update({ default_model_key: modelKey, updated_at: new Date().toISOString() })
    .eq("identity_key", identityKey);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Applies the theme to <html> immediately (dark is the AXONETIS default). */
export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const prefersLight =
    theme === "light" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: light)").matches);
  document.documentElement.classList.toggle("dark", !prefersLight);
  document.documentElement.dataset.theme = prefersLight ? "light" : "dark";
}
