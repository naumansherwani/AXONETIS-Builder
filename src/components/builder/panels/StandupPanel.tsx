/**
 * PHASE 11.2 — DAILY STANDUP CHAT (Outreach Engine).
 * Jimmy ka Roman Urdu standup message + 6 stats cards (scraped, qualified, sent,
 * replies, demos, closed) + issue highlight + real action buttons
 * (Pause/Resume campaign, Increase quota) writing to Supabase 3.
 * PHASE 11.3 compliance badge is embedded below the standup.
 * Zero dummy data — Jimmy writes `outreach_standups` from the Hetzner engine.
 */
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  Gauge,
  Handshake,
  MailCheck,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Reply,
  Search,
  Sparkle,
  Trophy,
} from "lucide-react";
import ComplianceBadge from "../ComplianceBadge";
import {
  fetchStandup,
  formatUsd,
  increaseQuota,
  setCampaignStatus,
  subscribeStandup,
  type Campaign,
  type Standup,
  type StandupIssue,
  type StandupStats,
} from "@/lib/outreach-api";

const CARDS: {
  key: keyof StandupStats;
  label: string;
  icon: typeof Search;
  tone: string;
}[] = [
  { key: "scraped", label: "Scraped", icon: Search, tone: "text-muted-foreground" },
  { key: "qualified", label: "Qualified", icon: Gauge, tone: "text-sky-300" },
  { key: "sent", label: "Sent", icon: MailCheck, tone: "text-cyan-300" },
  { key: "replies", label: "Replies", icon: Reply, tone: "text-amber-300" },
  { key: "demos", label: "Demos", icon: Handshake, tone: "text-[#c084fc]" },
  { key: "closed", label: "Closed", icon: Trophy, tone: "text-emerald-300" },
];

const ISSUE_TONE: Record<StandupIssue["severity"], string> = {
  critical: "border-[#E50914]/35 bg-[#E50914]/[0.08] text-[#ff7480]",
  warning: "border-amber-400/30 bg-amber-400/[0.07] text-amber-300",
  info: "border-white/[0.08] bg-white/[0.02] text-muted-foreground",
};

export default function StandupPanel() {
  const [standup, setStandup] = useState<Standup | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<StandupStats | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"pause" | "quota" | null>(null);

  const load = useCallback(async () => {
    const snap = await fetchStandup();
    setStandup(snap.standup);
    setCampaign(snap.campaign);
    setStats(snap.stats);
    setError(snap.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    return subscribeStandup(() => void load());
  }, [load]);

  const togglePause = useCallback(async () => {
    if (!campaign) return;
    setBusy("pause");
    const next = campaign.status === "paused" ? "running" : "paused";
    const res = await setCampaignStatus(campaign.id, next);
    if (res.ok) setCampaign({ ...campaign, status: next });
    else setError(res.error);
    setBusy(null);
  }, [campaign]);

  const bumpQuota = useCallback(async () => {
    if (!campaign) return;
    setBusy("quota");
    const res = await increaseQuota(campaign.id, campaign.daily_quota, 50);
    if (res.ok && res.quota != null) setCampaign({ ...campaign, daily_quota: res.quota });
    else setError(res.error);
    setBusy(null);
  }, [campaign]);

  const issues = standup?.issues ?? [];

  return (
    <div className="fb-no-scrollbar h-full min-h-0 overflow-y-auto bg-[#08080d]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#08080d]/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5 text-[#ff6b73]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
              Daily Standup
            </span>
            {standup && (
              <span className="font-mono text-[10px] text-muted-foreground/70">
                {new Date(standup.created_at).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {campaign && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  campaign.status === "running"
                    ? "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-300"
                    : "border-amber-400/30 bg-amber-400/[0.07] text-amber-300"
                }`}
              >
                {campaign.status === "running" ? "Campaign running" : "Campaign paused"}
              </span>
            )}
            <button
              onClick={() => void load()}
              className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              title="Refresh standup"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* Jimmy chat bubble */}
        <div className="flex gap-2.5">
          <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#E50914]/30 bg-[#E50914]/[0.08] text-[11px] font-bold text-[#ff7480] shadow-[0_0_22px_-10px_rgba(229,9,20,0.7)]">
            J
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[#ff7480]">Jimmy</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                Supreme Commander
              </span>
            </div>
            <motion.div
              key={standup?.id ?? "empty"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 text-[12.5px] leading-relaxed text-foreground/90"
            >
              {standup?.message ?? (
                <span className="text-muted-foreground">
                  Aaj ka standup abhi nahi aaya. Jimmy engine par outreach cycle chalayega to yeh
                  bubble live update hoga.
                </span>
              )}
            </motion.div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {CARDS.map(({ key, label, icon: Icon, tone }) => (
            <div
              key={key}
              className="rounded-xl border border-white/[0.06] bg-white/[0.012] p-2.5 transition-colors hover:border-white/[0.12]"
            >
              <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/75">
                <Icon className={`h-3 w-3 ${tone}`} />
                {label}
              </div>
              <motion.div
                key={`${key}-${stats?.[key] ?? 0}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-1 font-mono text-[22px] font-bold ${tone}`}
              >
                {stats?.[key] ?? 0}
              </motion.div>
            </div>
          ))}
        </div>

        {/* Issue highlight */}
        {issues.length > 0 && (
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <div
                key={`${issue.title}-${i}`}
                className={`flex items-start gap-2 rounded-xl border p-2.5 ${ISSUE_TONE[issue.severity]}`}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold">{issue.title}</div>
                  {issue.detail && (
                    <div className="mt-0.5 text-[11px] leading-relaxed opacity-80">
                      {issue.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.012] p-3">
          <button
            onClick={() => void togglePause()}
            disabled={!campaign || busy !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-400/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {campaign?.status === "paused" ? (
              <Play className="h-3 w-3" />
            ) : (
              <Pause className="h-3 w-3" />
            )}
            {campaign?.status === "paused" ? "Resume campaign" : "Pause campaign"}
          </button>
          <button
            onClick={() => void bumpQuota()}
            disabled={!campaign || busy !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-400/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkle className="h-3 w-3" />
            Increase quota +50
          </button>
          {campaign ? (
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              {campaign.provider ?? "provider —"} · {campaign.sent_today}/{campaign.daily_quota}{" "}
              today
            </span>
          ) : (
            <span className="ml-auto text-[11px] text-muted-foreground/70">
              Koi campaign row nahi — engine campaign banata hai
            </span>
          )}
        </div>

        {/* PHASE 11.3 */}
        <ComplianceBadge />

        {stats && stats.closed > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] p-2.5 text-[11px] text-emerald-300">
            <MessageSquare className="h-3.5 w-3.5" />
            {stats.closed} closed deals live — pipeline value pipeline tab par{" "}
            {formatUsd(stats.closed)} rows.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-[#E50914]/30 bg-[#E50914]/[0.06] p-2 text-[11px] text-[#ff7480]">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
