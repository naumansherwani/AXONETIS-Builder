/**
 * Phase 10.8 — Browser-Use Agent panel.
 * URL input + validate · screenshot stream (SSE) · action log ·
 * emergency stop · Sherlock supervision badge.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Loader2, OctagonX, Play, ShieldCheck } from "lucide-react";
import { PanelSection } from "./PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import {
  actionTone,
  openBrowserStream,
  startBrowserRun,
  stopBrowserRun,
  validateUrl,
  validateUrlShape,
  type BrowserAction,
  type BrowserFrame,
  type BrowserSupervision,
} from "@/lib/browser-agent-api";

export default function BrowserAgentPanel() {
  const { project } = useBuilder();
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [valid, setValid] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [frame, setFrame] = useState<BrowserFrame | null>(null);
  const [actions, setActions] = useState<BrowserAction[]>([]);
  const [supervision, setSupervision] = useState<BrowserSupervision>({
    verdict: "watching",
    note: null,
  });
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => () => closeRef.current?.(), []);

  const doValidate = useCallback(async () => {
    setChecking(true);
    setError(null);
    const shape = validateUrlShape(url);
    if (!shape.ok) {
      setValid({ ok: false, reason: shape.reason });
      setChecking(false);
      return;
    }
    setUrl(shape.url);
    const remote = await validateUrl(shape.url);
    setChecking(false);
    setValid(remote ? { ok: remote.ok, reason: remote.reason } : { ok: true, reason: "shape only" });
  }, [url]);

  const start = useCallback(async () => {
    const shape = validateUrlShape(url);
    if (!shape.ok) {
      setValid({ ok: false, reason: shape.reason });
      return;
    }
    setError(null);
    setActions([]);
    setFrame(null);
    const res = await startBrowserRun(project, shape.url, goal.trim());
    if (!res?.sessionId) {
      setError("Start fail — /rpc/browser.start pending ya headless runner offline.");
      return;
    }
    setSessionId(res.sessionId);
    setSupervision({ verdict: "watching", note: null });
    closeRef.current = openBrowserStream(project, res.sessionId, {
      onFrame: setFrame,
      onAction: (a) => setActions((list) => [a, ...list].slice(0, 120)),
      onSupervision: setSupervision,
      onDone: (reason) => {
        setSessionId(null);
        setActions((list) => [
          {
            id: `done_${Date.now()}`,
            at: Date.now(),
            kind: "wait",
            detail: `stream ended — ${reason}`,
          },
          ...list,
        ]);
      },
    });
  }, [goal, project, url]);

  const stop = useCallback(async () => {
    if (!sessionId) return;
    await stopBrowserRun(project, sessionId);
    closeRef.current?.();
    closeRef.current = null;
    setSessionId(null);
    setSupervision({ verdict: "halted", note: "Founder emergency halt" });
  }, [project, sessionId]);

  const supTone =
    supervision.verdict === "halted"
      ? "border-[#E50914]/40 bg-[#E50914]/10 text-[#ff7480]"
      : supervision.verdict === "approved"
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
        : "border-[#a855f7]/30 bg-[#a855f7]/10 text-[#c084fc]";

  return (
    <div>
      <PanelSection title="Target">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setValid(null);
              }}
              placeholder="https://axonetis.com"
              className="min-w-0 flex-1 rounded border border-white/[0.08] bg-black/40 px-2 py-1 font-mono text-[10.5px] text-foreground/90 outline-none focus:border-[#E50914]/40"
            />
            <button
              type="button"
              onClick={() => void doValidate()}
              disabled={checking || !url.trim()}
              className="inline-flex items-center gap-1 rounded border border-white/12 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/85 hover:bg-white/[0.08] disabled:opacity-50"
            >
              {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
              check
            </button>
          </div>
          {valid && (
            <p
              className={`text-[10px] ${valid.ok ? "text-emerald-300" : "text-[#ff7480]"}`}
            >
              {valid.ok ? `reachable${valid.reason ? ` (${valid.reason})` : ""}` : valid.reason}
            </p>
          )}
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Goal — e.g. pricing page se plans extract karo"
            className="w-full rounded border border-white/[0.08] bg-black/40 px-2 py-1 text-[10.5px] text-foreground/90 outline-none focus:border-[#E50914]/40"
          />
          <div className="flex items-center gap-1.5">
            {sessionId ? (
              <button
                type="button"
                onClick={() => void stop()}
                className="inline-flex items-center gap-1.5 rounded border border-[#E50914]/40 bg-[#E50914]/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#ff7480] hover:bg-[#E50914]/25"
              >
                <OctagonX className="h-3 w-3" /> stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void start()}
                disabled={!url.trim()}
                className="inline-flex items-center gap-1.5 rounded border border-[#E50914]/30 bg-[#E50914]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#ff7480] hover:bg-[#E50914]/15 disabled:opacity-50"
              >
                <Play className="h-3 w-3" /> run agent
              </button>
            )}
            <span
              className={`ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${supTone}`}
              title={supervision.note ?? "Sherlock live supervision"}
            >
              <ShieldCheck className="h-3 w-3" /> sherlock {supervision.verdict}
            </span>
          </div>
          {error && <p className="text-[10.5px] text-[#ff7480]">{error}</p>}
        </div>
      </PanelSection>

      <PanelSection title="Screenshot stream">
        <div className="overflow-hidden rounded border border-white/[0.08] bg-black/60">
          {frame ? (
            <img src={frame.dataUrl} alt="browser frame" className="block w-full" />
          ) : (
            <div className="grid h-32 place-items-center text-[10.5px] text-muted-foreground">
              {sessionId ? "frame ka intezaar…" : "run start karo"}
            </div>
          )}
        </div>
        {frame && (
          <div className="mt-1 truncate font-mono text-[9.5px] text-muted-foreground/70">
            {frame.url}
          </div>
        )}
      </PanelSection>

      <PanelSection title={`Action log · ${actions.length}`}>
        {actions.length === 0 ? (
          <p className="px-1 py-1 text-[10.5px] text-muted-foreground">koi action nahi</p>
        ) : (
          <ul className="space-y-0.5">
            {actions.map((a) => (
              <li key={a.id} className="flex items-start gap-2 px-1 py-0.5">
                <span
                  className={`shrink-0 font-mono text-[9px] font-semibold uppercase ${actionTone(a.kind)}`}
                >
                  {a.kind}
                </span>
                <span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-foreground/80">
                  {a.detail}
                  {a.selector && (
                    <span className="ml-1 font-mono text-[9.5px] text-muted-foreground/70">
                      {a.selector}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  );
}
