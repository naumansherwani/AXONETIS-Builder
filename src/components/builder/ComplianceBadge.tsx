/**
 * PHASE 11.3 — COMPLIANCE BADGE (Outreach Engine).
 * GDPR badge (green/amber/red) · spam score bands (<3 green, 3-5 amber, >5 red)
 * · unsubscribe link check ✅/❌ · Sherlock approval stamp.
 * Reads the latest `outreach_compliance` row from Supabase 3. Zero dummy data.
 */
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, RefreshCw, ShieldCheck, X } from "lucide-react";
import {
  complianceTone,
  fetchCompliance,
  spamTone,
  subscribeCompliance,
  type Compliance,
  type Tone,
} from "@/lib/outreach-api";

const TONE_CLASS: Record<Tone, string> = {
  green: "text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.07]",
  amber: "text-amber-300 border-amber-400/30 bg-amber-400/[0.07]",
  red: "text-[#ff7480] border-[#E50914]/35 bg-[#E50914]/[0.08]",
  muted: "text-muted-foreground border-white/[0.08] bg-white/[0.02]",
};

export function useCompliance() {
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const snap = await fetchCompliance();
    setCompliance(snap.compliance);
    setError(snap.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    return subscribeCompliance(() => void load());
  }, [load]);

  return { compliance, error, loading, reload: load };
}

/** Compact pill — used in the pipeline / standup headers. */
export function CompliancePill({ compliance }: { compliance: Compliance | null }) {
  const tone = complianceTone(compliance);
  const label = !compliance
    ? "Compliance: no scan"
    : tone === "green"
      ? "GDPR compliant"
      : tone === "amber"
        ? "GDPR review"
        : "GDPR risk";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${TONE_CLASS[tone]}`}
    >
      <ShieldCheck className="h-3 w-3" />
      {label}
    </span>
  );
}

export default function ComplianceBadge() {
  const { compliance, error, loading, reload } = useCompliance();
  const spam = spamTone(compliance?.spam_score ?? null);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.012] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
          Compliance
        </span>
        <div className="flex items-center gap-2">
          <CompliancePill compliance={compliance} />
          <button
            onClick={() => void reload()}
            className="grid h-6 w-6 place-items-center rounded border border-white/[0.08] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            title="Re-read latest compliance scan"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {/* Spam score */}
        <div className={`rounded-lg border p-2.5 ${TONE_CLASS[spam]}`}>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.2em] opacity-80">
            Spam score
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <motion.span
              key={String(compliance?.spam_score)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-[20px] font-bold"
            >
              {compliance?.spam_score ?? "—"}
            </motion.span>
            <span className="text-[10px] opacity-70">/ 10 · target &lt; 3</span>
          </div>
        </div>

        {/* Unsubscribe */}
        <div
          className={`rounded-lg border p-2.5 ${TONE_CLASS[!compliance ? "muted" : compliance.unsubscribe_ok ? "green" : "red"]}`}
        >
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.2em] opacity-80">
            Unsubscribe link
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold">
            {!compliance ? (
              "—"
            ) : compliance.unsubscribe_ok ? (
              <>
                <Check className="h-3.5 w-3.5" /> Present
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5" /> Missing
              </>
            )}
          </div>
        </div>

        {/* Sherlock stamp */}
        <div
          className={`rounded-lg border p-2.5 ${
            !compliance
              ? TONE_CLASS.muted
              : compliance.sherlock_approved
                ? "border-[#a855f7]/35 bg-[#a855f7]/[0.08] text-[#c084fc]"
                : TONE_CLASS.amber
          }`}
        >
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.2em] opacity-80">
            Sherlock stamp
          </div>
          <div className="mt-1 text-[12px] font-semibold">
            {!compliance ? "—" : compliance.sherlock_approved ? "Approved" : "Pending audit"}
          </div>
          {compliance?.sherlock_approved_at && (
            <div className="mt-0.5 font-mono text-[9.5px] opacity-70">
              {new Date(compliance.sherlock_approved_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {compliance?.gdpr_note && (
        <div className="mt-2 rounded-md border border-white/[0.06] bg-white/[0.015] p-2 text-[11px] leading-relaxed text-muted-foreground">
          {compliance.gdpr_note}
        </div>
      )}
      {compliance?.sherlock_note && (
        <div className="mt-2 rounded-md border border-[#a855f7]/20 bg-[#a855f7]/[0.05] p-2 text-[11px] leading-relaxed text-[#d8b4fe]">
          Sherlock: {compliance.sherlock_note}
        </div>
      )}
      {!compliance && !loading && (
        <div className="mt-2 text-[11px] text-muted-foreground/70">
          Koi compliance scan record nahi — Sherlock scan ke baad yahan live aa jayega.
        </div>
      )}
      {error && <div className="mt-2 text-[11px] text-[#ff7480]">{error}</div>}
    </div>
  );
}
