/**
 * Secrets panel — masked list + rotate action. Values never leave server.
 * Grouped by scope (runtime / build / provider).
 */
import { useEffect, useState } from "react";
import { Key, Loader2, RotateCw, Shield } from "lucide-react";
import { PanelSection, Row } from "./PanelChrome";
import { fetchSecrets, rotateSecret, type SecretRow } from "@/lib/secrets-api";

const SCOPE_LABEL: Record<SecretRow["scope"], string> = {
  runtime: "Runtime",
  build: "Build",
  provider: "Provider Keys",
};

export default function SecretsPanel() {
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    return fetchSecrets()
      .then((s) => { setSecrets(s.secrets); setLive(s.live); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    void load().then(() => { if (!alive) return; });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups: SecretRow["scope"][] = ["runtime", "build", "provider"];

  const doRotate = async (name: string) => {
    setRotating(name);
    await rotateSecret(name);
    setRotating(null);
    await load();
  };

  return (
    <div>
      <PanelSection
        title="Vault"
        action={
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            <Shield className="h-3 w-3 text-emerald-400/80" />
            {live ? "encrypted · live" : "offline"}
          </span>
        }
      >
        <div className="px-2 py-1 text-[10.5px] leading-relaxed text-muted-foreground/70">
          Values never leave the Hetzner brain. Rotate mints a new value server-side.
        </div>
      </PanelSection>

      {groups.map((scope) => {
        const rows = secrets.filter((s) => s.scope === scope);
        return (
          <PanelSection
            key={scope}
            title={SCOPE_LABEL[scope]}
            action={<span className="text-[10px] text-muted-foreground/60">{rows.length}</span>}
          >
            {!rows.length ? (
              <div className="px-2 py-2 text-[11px] text-muted-foreground/60">
                {live ? "None." : "—"}
              </div>
            ) : (
              <div className="flex flex-col">
                {rows.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12px] text-foreground/80 hover:bg-white/[0.04]"
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <Key className="h-3.5 w-3.5 text-[#a855f7]" />
                      <span className="font-mono truncate">{s.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/60">{s.maskedPreview}</span>
                    </span>
                    <button
                      onClick={() => doRotate(s.name)}
                      disabled={rotating === s.name || !live}
                      className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 transition hover:bg-white/[0.08] hover:text-foreground disabled:opacity-40"
                    >
                      {rotating === s.name ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-1"><RotateCw className="h-3 w-3" />rotate</span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
        );
      })}
    </div>
  );
}
