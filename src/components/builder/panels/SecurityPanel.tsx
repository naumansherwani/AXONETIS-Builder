/**
 * Security panel — Sherlock scan snapshot: GDPR, RLS, secret leaks, findings.
 * Founder can trigger fresh scan.
 */
import { useEffect, useState } from "react";
import { Shield, ShieldCheck, ShieldAlert, Loader2, Play } from "lucide-react";
import { PanelSection, Row } from "./PanelChrome";
import {
  fetchSecurity,
  triggerSherlockScan,
  type SecuritySnapshot,
  type Severity,
} from "@/lib/security-api";

const sevColor: Record<Severity, string> = {
  critical: "text-red-500",
  high: "text-[#ff7480]",
  medium: "text-amber-400",
  low: "text-blue-400",
  info: "text-muted-foreground",
};

export default function SecurityPanel() {
  const [snap, setSnap] = useState<SecuritySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = () => {
    setLoading(true);
    return fetchSecurity()
      .then((s) => setSnap(s))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const runScan = async () => {
    setScanning(true);
    await triggerSherlockScan();
    setTimeout(() => {
      load();
      setScanning(false);
    }, 1500);
  };

  const score = snap?.score ?? 0;
  const scoreColor =
    score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-[#ff7480]";

  return (
    <div>
      <PanelSection
        title="Sherlock Scan"
        action={
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-foreground/80 hover:bg-white/[0.08] disabled:opacity-40"
          >
            {scanning ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Play className="h-2.5 w-2.5" />
            )}
            {scanning ? "scanning" : "scan"}
          </button>
        }
      >
        <Row
          left={
            <>
              <Shield className={`h-3.5 w-3.5 ${scoreColor}`} />
              <span>Security score</span>
            </>
          }
          right={
            <span className={`font-mono font-semibold ${scoreColor}`}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : `${score}/100`}
            </span>
          }
        />
        <Row
          left={
            <>
              <ShieldCheck
                className={`h-3.5 w-3.5 ${snap?.gdpr_ok ? "text-emerald-400" : "text-muted-foreground/50"}`}
              />
              <span>GDPR</span>
            </>
          }
          right={
            <span className={snap?.gdpr_ok ? "text-emerald-400" : "text-muted-foreground/60"}>
              {snap?.gdpr_ok ? "ok" : "unknown"}
            </span>
          }
        />
        <Row
          left={
            <>
              <ShieldCheck
                className={`h-3.5 w-3.5 ${snap?.rls_ok ? "text-emerald-400" : "text-muted-foreground/50"}`}
              />
              <span>RLS policies</span>
            </>
          }
          right={
            <span className={snap?.rls_ok ? "text-emerald-400" : "text-muted-foreground/60"}>
              {snap?.rls_ok ? "enforced" : "unknown"}
            </span>
          }
        />
        <Row
          left={
            <>
              <ShieldAlert
                className={`h-3.5 w-3.5 ${snap?.secrets_leaked ? "text-red-500" : "text-muted-foreground/50"}`}
              />
              <span>Secret leaks</span>
            </>
          }
          right={
            <span
              className={`font-mono ${snap?.secrets_leaked ? "text-red-500" : "text-emerald-400"}`}
            >
              {snap?.secrets_leaked ?? 0}
            </span>
          }
        />
      </PanelSection>

      <PanelSection
        title="Findings"
        action={
          <span className="text-[10px] text-muted-foreground/60">{snap?.findings.length ?? 0}</span>
        }
      >
        {!snap?.findings.length ? (
          <div className="px-2 py-3 text-[11px] text-muted-foreground/60">
            {snap?.live ? "No open findings. 🛡️" : "Server offline — no scan data."}
          </div>
        ) : (
          <div className="flex flex-col">
            {snap.findings.slice(0, 10).map((f) => (
              <Row
                key={f.id}
                left={
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-[9px] font-mono uppercase ${sevColor[f.severity]}`}>
                      {f.severity}
                    </span>
                    <span className="truncate">{f.title}</span>
                  </span>
                }
                right={
                  f.path ? (
                    <span className="font-mono text-[10px] text-muted-foreground/60 truncate max-w-[100px]">
                      {f.path}
                    </span>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </PanelSection>

      <div className="mt-2 flex items-center justify-between px-2 text-[10px] text-muted-foreground/50">
        <span>{snap?.live ? "● live" : "○ offline"}</span>
        <span>
          {snap?.last_scan_at ? new Date(snap.last_scan_at).toLocaleTimeString() : "never scanned"}
        </span>
      </div>
    </div>
  );
}
