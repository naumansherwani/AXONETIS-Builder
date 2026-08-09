/**
 * Phase 10.13 — Founder Sandbox switcher + isolation banner.
 * Production / Sandbox toggle, reset with typed "RESET" confirmation,
 * orange isolated banner and temporary-data warning.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FlaskConical, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import {
  fetchSandboxStatus,
  readLocalEnvKind,
  resetSandbox,
  RESET_CONFIRM_WORD,
  switchEnv,
  writeLocalEnvKind,
  type EnvKind,
  type SandboxStatus,
} from "@/lib/sandbox-api";

export function useSandboxKind(): EnvKind {
  const [kind, setKind] = useState<EnvKind>("production");
  useEffect(() => {
    setKind(readLocalEnvKind());
    const onChange = (e: Event) => {
      const k = (e as CustomEvent<{ kind: EnvKind }>).detail?.kind;
      if (k) setKind(k);
    };
    window.addEventListener("axonetis:sandbox:kind", onChange);
    return () => window.removeEventListener("axonetis:sandbox:kind", onChange);
  }, []);
  return kind;
}

function broadcast(kind: EnvKind) {
  writeLocalEnvKind(kind);
  window.dispatchEvent(new CustomEvent("axonetis:sandbox:kind", { detail: { kind } }));
}

export default function SandboxSwitcher() {
  const { project } = useBuilder();
  const kind = useSandboxKind();
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [word, setWord] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void fetchSandboxStatus(project).then((s) => {
      if (s) {
        setStatus(s);
        broadcast(s.kind);
      }
    });
  }, [project]);

  const toggle = useCallback(
    async (next: EnvKind) => {
      if (next === kind) return;
      setBusy(true);
      broadcast(next);
      const s = await switchEnv(project, next);
      setBusy(false);
      if (s) {
        setStatus(s);
        broadcast(s.kind);
      }
    },
    [kind, project],
  );

  const doReset = useCallback(async () => {
    if (word !== RESET_CONFIRM_WORD) return;
    setBusy(true);
    const res = await resetSandbox(project);
    setBusy(false);
    setNote(
      res?.ok
        ? "Sandbox reset ho gaya."
        : (res?.error ?? "Reset fail — /rpc/sandbox.reset pending."),
    );
    setModal(false);
    setWord("");
    const s = await fetchSandboxStatus(project);
    if (s) setStatus(s);
  }, [project, word]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center rounded-full border border-white/10 bg-black/40 p-[2px]">
        {(["production", "sandbox"] as EnvKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => void toggle(k)}
            disabled={busy}
            className={`rounded-full px-2 py-[3px] text-[9.5px] font-semibold uppercase tracking-wider transition-colors ${
              kind === k
                ? k === "sandbox"
                  ? "bg-amber-400/20 text-amber-300 shadow-[0_0_16px_-6px_#fbbf24]"
                  : "bg-[#E50914]/20 text-[#ff7480] shadow-[0_0_16px_-6px_#E50914]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "sandbox" ? "Sandbox" : "Production"}
          </button>
        ))}
      </div>

      {kind === "sandbox" && (
        <button
          type="button"
          onClick={() => setModal(true)}
          className="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-[3px] text-[9.5px] font-semibold uppercase tracking-wider text-amber-300 hover:bg-amber-400/15"
          title="Sandbox data reset"
        >
          <Trash2 className="h-3 w-3" /> reset
        </button>
      )}

      {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {note && <span className="text-[9.5px] text-muted-foreground">{note}</span>}

      {modal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-sm">
          <div className="w-[380px] rounded-xl border border-amber-400/25 bg-[#0b0b11] p-4 shadow-[0_30px_90px_-30px_rgba(251,191,36,0.4)]">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-300" />
              <h3 className="text-[13px] font-semibold text-foreground/95">Sandbox reset</h3>
            </div>
            <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
              Sandbox ka saara data delete ho jayega — production ko koi farq nahi padta. Confirm
              karne ke liye <span className="font-mono text-amber-300">{RESET_CONFIRM_WORD}</span>{" "}
              type karo.
            </p>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={RESET_CONFIRM_WORD}
              className="mb-3 w-full rounded border border-white/[0.08] bg-black/40 px-2 py-1.5 font-mono text-[12px] tracking-widest text-foreground/90 outline-none focus:border-amber-400/40"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModal(false);
                  setWord("");
                }}
                className="rounded border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-foreground/85 hover:bg-white/[0.08]"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={() => void doReset()}
                disabled={word !== RESET_CONFIRM_WORD || busy}
                className="rounded border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-amber-300 hover:bg-amber-400/25 disabled:opacity-40"
              >
                reset sandbox
              </button>
            </div>
          </div>
        </div>
      )}
      {status?.isolated && kind === "sandbox" && (
        <span className="hidden text-[9px] text-muted-foreground xl:inline">
          {status.rows ?? 0} rows
        </span>
      )}
    </div>
  );
}

/** Orange isolation banner — mount right under the top bar. */
export function SandboxBanner() {
  const kind = useSandboxKind();
  if (kind !== "sandbox") return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-400/25 bg-amber-400/[0.08] px-3 py-1 text-[10.5px] text-amber-200">
      <FlaskConical className="h-3 w-3" />
      <span className="font-semibold uppercase tracking-wider">Sandbox isolated</span>
      <span className="inline-flex items-center gap-1 text-amber-200/80">
        <AlertTriangle className="h-3 w-3" /> Sandbox data is temporary — production untouched.
      </span>
    </div>
  );
}
