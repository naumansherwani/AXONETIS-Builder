/**
 * PHASE 11.1 — PIPELINE DASHBOARD (Outreach Engine).
 * Kanban: Scraped → Qualified → Contacted → Replied → Demo → Closed
 * Drag-drop between columns (writes stage to Supabase 3), live ARR counter,
 * lead detail modal. Zero dummy data — empty until Jimmy scrapes real leads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Mail, RefreshCw, TrendingUp, User, X, Globe, Bot } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  computeArr,
  computeWeightedArr,
  fetchPipeline,
  formatUsd,
  groupByStage,
  moveLead,
  subscribePipeline,
  type Lead,
  type PipelineStage,
} from "@/lib/outreach-api";

const STAGE_TONE: Record<PipelineStage, string> = {
  scraped: "text-muted-foreground border-white/[0.08]",
  qualified: "text-sky-300 border-sky-400/25",
  contacted: "text-cyan-300 border-cyan-400/25",
  replied: "text-amber-300 border-amber-400/25",
  demo: "text-[#c084fc] border-[#a855f7]/30",
  closed: "text-emerald-300 border-emerald-400/30",
};

export default function PipelinePanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    const snap = await fetchPipeline();
    setLeads(snap.leads);
    setError(snap.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    return subscribePipeline(() => void load());
  }, [load]);

  const columns = useMemo(() => groupByStage(leads), [leads]);
  const arr = useMemo(() => computeArr(leads), [leads]);
  const weighted = useMemo(() => computeWeightedArr(leads), [leads]);
  const progress = Math.min(100, (arr / 1_000_000) * 100);

  const drop = useCallback(
    async (stage: PipelineStage) => {
      const id = dragId;
      setDragId(null);
      setOverStage(null);
      if (!id) return;
      const prev = leads;
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l)));
      const res = await moveLead(id, stage);
      if (!res.ok) {
        setLeads(prev);
        setError(res.error);
      }
    },
    [dragId, leads],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#08080d]">
      {/* ARR header */}
      <div className="shrink-0 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              Annual Recurring Revenue
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <motion.span
                key={arr}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-[26px] font-bold text-emerald-300 [text-shadow:0_0_22px_rgba(52,211,153,0.45)]"
              >
                {formatUsd(arr)}
              </motion.span>
              <span className="text-[11px] text-muted-foreground">
                / $1M target · weighted {formatUsd(weighted)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">{leads.length} leads</span>
            <button
              onClick={() => void load()}
              className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              title="Refresh pipeline"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#E50914]"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          />
        </div>
        {error && <div className="mt-2 text-[11px] text-[#ff7480]">{error}</div>}
      </div>

      {/* Kanban */}
      <div className="fb-no-scrollbar flex min-h-0 flex-1 gap-2.5 overflow-x-auto p-3">
        {PIPELINE_STAGES.map((stage) => {
          const items = columns[stage];
          const isOver = overStage === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={() => void drop(stage)}
              className={`flex w-[220px] shrink-0 flex-col rounded-xl border bg-white/[0.012] transition-colors ${
                isOver ? "border-[#E50914]/50 bg-[#E50914]/[0.06]" : "border-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${STAGE_TONE[stage].split(" ")[0]}`}
                >
                  {STAGE_LABEL[stage]}
                </span>
                <span className="rounded-full border border-white/[0.08] px-1.5 text-[10px] font-mono text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="fb-no-scrollbar flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto p-2">
                {items.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setSelected(lead)}
                    className={`cursor-grab rounded-lg border bg-[#0c0c12] p-2.5 text-left transition-all hover:border-white/[0.16] active:cursor-grabbing ${
                      dragId === lead.id ? "opacity-40" : ""
                    } ${STAGE_TONE[lead.stage].split(" ")[1]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold text-foreground/95">
                        {lead.company}
                      </span>
                      {lead.mrr_value > 0 && (
                        <span className="shrink-0 font-mono text-[10px] text-emerald-300">
                          {formatUsd(lead.mrr_value)}/mo
                        </span>
                      )}
                    </div>
                    {lead.contact_name && (
                      <div className="mt-1 truncate text-[10.5px] text-muted-foreground">
                        {lead.contact_name}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                      {lead.industry && <span className="truncate">{lead.industry}</span>}
                      {lead.score != null && (
                        <span className="ml-auto font-mono text-[#ff7480]">{lead.score}</span>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="grid flex-1 place-items-center text-[10px] text-muted-foreground/50">
                    empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

function LeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-white/[0.08] bg-[#0a0a10] p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#ff6b73]" />
            <span className="text-[13px] font-semibold text-foreground/95">{lead.company}</span>
          </div>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-2.5 px-4 py-4 text-[12px]">
          <Field icon={User} label="Contact" value={lead.contact_name} />
          <Field icon={Mail} label="Email" value={lead.email} />
          <Field icon={Globe} label="Website" value={lead.website} />
          <Field icon={Bot} label="Owner agent" value={lead.owner_agent} />
          <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.015] px-2.5 py-2">
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Stage
            </span>
            <span className="text-[11px] font-semibold text-foreground/90">
              {STAGE_LABEL[lead.stage]}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.015] px-2.5 py-2">
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              MRR
            </span>
            <span className="font-mono text-[11px] text-emerald-300">
              {formatUsd(lead.mrr_value)}/mo · {formatUsd(lead.mrr_value * 12)} ARR
            </span>
          </div>
          {lead.notes && (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.015] p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {lead.notes}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/[0.06] bg-white/[0.015] px-2.5 py-2">
      <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="truncate text-[11px] text-foreground/90">{value ?? "—"}</span>
    </div>
  );
}
