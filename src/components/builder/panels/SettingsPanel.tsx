/**
 * PHASE 12.1 — SETTINGS PANEL.
 * Founder-only controls: AI model per agent (dropdown from ai_model_registry),
 * memory limit slider, cost thresholds (daily/weekly/monthly), notification
 * preference and theme (Dark default / Light / System).
 * Every value persists to Supabase 3 (`founder_settings` / `ai_agent_identities`).
 */
import { useCallback, useEffect, useState } from "react";
import { Bell, Brain, Check, Coins, Loader2, Monitor, Moon, RefreshCw, Sun } from "lucide-react";
import { PanelSection } from "./PanelChrome";
import {
  applyTheme,
  fetchSettings,
  readLocalSettings,
  saveSettings,
  setAgentModel,
  type AgentIdentity,
  type FounderSettings,
  type ModelOption,
  type NotifyMode,
  type ThemeMode,
} from "@/lib/settings-api";

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
];

const NOTIFY: { id: NotifyMode; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "in-app", label: "In-app" },
  { id: "none", label: "None" },
];

const COST_FIELDS: { key: keyof FounderSettings; label: string }[] = [
  { key: "cost_daily_usd", label: "Daily" },
  { key: "cost_weekly_usd", label: "Weekly" },
  { key: "cost_monthly_usd", label: "Monthly" },
];

export default function SettingsPanel() {
  const [settings, setSettings] = useState<FounderSettings>(() => readLocalSettings());
  const [models, setModels] = useState<ModelOption[]>([]);
  const [agents, setAgents] = useState<AgentIdentity[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const snap = await fetchSettings();
    setSettings(snap.settings);
    setModels(snap.models);
    setAgents(snap.agents);
    setError(snap.error);
    applyTheme(snap.settings.theme);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(async (p: Partial<FounderSettings>) => {
    setSettings((prev) => ({ ...prev, ...p }));
    if (p.theme) applyTheme(p.theme);
    const res = await saveSettings(p);
    setSettings(res.settings);
    setError(res.ok ? undefined : res.error);
    if (res.ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    }
  }, []);

  const changeAgentModel = useCallback(async (identityKey: string, modelKey: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.identity_key === identityKey ? { ...a, default_model_key: modelKey } : a)),
    );
    const res = await setAgentModel(identityKey, modelKey);
    if (!res.ok) setError(res.error);
  }, []);

  return (
    <div className="space-y-1">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/70">
          Phase 12.1 · Founder settings
        </span>
        <div className="flex items-center gap-1.5">
          {saved && <Check className="h-3.5 w-3.5 text-emerald-400" />}
          <button
            onClick={() => void load()}
            className="grid h-6 w-6 place-items-center rounded border border-white/[0.08] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            title="Reload settings"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* AI model per agent */}
      <PanelSection title="AI model per agent">
        {agents.length === 0 ? (
          <div className="p-2 text-[11px] text-muted-foreground">
            Koi active agent identity nahi mili — `ai_agent_identities` seed karo.
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((a) => {
              const options = models.filter((m) => m.role === a.role || m.role === "router");
              const pool = options.length ? options : models;
              return (
                <label key={a.identity_key} className="block">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11.5px] font-medium text-foreground/90">
                      {a.display_name}
                    </span>
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground/70">
                      {a.role}
                    </span>
                  </div>
                  <select
                    value={a.default_model_key}
                    onChange={(e) => void changeAgentModel(a.identity_key, e.target.value)}
                    className="w-full rounded-md border border-white/[0.08] bg-[#0c0c13] px-2 py-1.5 text-[11px] text-foreground/90 outline-none focus:border-[#E50914]/40"
                  >
                    {pool.map((m) => (
                      <option key={m.model_key} value={m.model_key}>
                        {m.display_name} · {m.provider}
                        {m.tier ? ` · ${m.tier}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        )}
      </PanelSection>

      {/* Memory limit */}
      <PanelSection title="Memory limit">
        <div className="p-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Brain className="h-3 w-3 text-[#c084fc]" />
              Agent context memory
            </span>
            <span className="font-mono text-[12px] font-bold text-[#c084fc]">
              {settings.memory_limit_mb} MB
            </span>
          </div>
          <input
            type="range"
            min={64}
            max={4096}
            step={64}
            value={settings.memory_limit_mb}
            onChange={(e) =>
              setSettings((p) => ({ ...p, memory_limit_mb: Number(e.target.value) }))
            }
            onMouseUp={(e) =>
              void patch({ memory_limit_mb: Number((e.target as HTMLInputElement).value) })
            }
            onTouchEnd={(e) =>
              void patch({ memory_limit_mb: Number((e.target as HTMLInputElement).value) })
            }
            className="w-full accent-[#E50914]"
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground/60">
            <span>64 MB</span>
            <span>4096 MB</span>
          </div>
        </div>
      </PanelSection>

      {/* Cost thresholds */}
      <PanelSection title="Cost thresholds (USD)">
        <div className="space-y-2 p-1">
          {COST_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2">
              <span className="flex w-20 items-center gap-1.5 text-[11px] text-muted-foreground">
                <Coins className="h-3 w-3 text-amber-300" />
                {label}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={String(settings[key])}
                onChange={(e) => setSettings((p) => ({ ...p, [key]: Number(e.target.value) }))}
                onBlur={(e) =>
                  void patch({ [key]: Number(e.target.value) } as Partial<FounderSettings>)
                }
                className="flex-1 rounded-md border border-white/[0.08] bg-[#0c0c13] px-2 py-1.5 font-mono text-[11px] text-foreground/90 outline-none focus:border-amber-400/40"
              />
            </label>
          ))}
        </div>
      </PanelSection>

      {/* Notifications */}
      <PanelSection title="Notifications">
        <div className="flex gap-1.5 p-1">
          {NOTIFY.map((n) => (
            <button
              key={n.id}
              onClick={() => void patch({ notify_mode: n.id })}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                settings.notify_mode === n.id
                  ? "border-[#E50914]/40 bg-[#E50914]/[0.1] text-[#ff7480]"
                  : "border-white/[0.08] text-muted-foreground hover:bg-white/[0.05]"
              }`}
            >
              <Bell className="h-3 w-3" />
              {n.label}
            </button>
          ))}
        </div>
      </PanelSection>

      {/* Theme */}
      <PanelSection title="Theme">
        <div className="flex gap-1.5 p-1">
          {THEMES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => void patch({ theme: id })}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                settings.theme === id
                  ? "border-sky-400/40 bg-sky-400/[0.1] text-sky-300"
                  : "border-white/[0.08] text-muted-foreground hover:bg-white/[0.05]"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </PanelSection>

      {error && (
        <div className="rounded-md border border-[#E50914]/30 bg-[#E50914]/[0.06] p-2 text-[11px] text-[#ff7480]">
          {error}
        </div>
      )}
    </div>
  );
}
