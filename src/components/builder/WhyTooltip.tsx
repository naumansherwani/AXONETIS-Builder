/**
 * Phase 10.14 — Explainability layer.
 * "Why" hover tooltip on every AI output: model used, memory entries referenced,
 * tools called, and the decision-chain timeline.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, HelpCircle, Loader2, Wrench } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { fetchExplanation, stepTone, type Explanation } from "@/lib/explain-api";
import { formatUsd, shortModelTag } from "@/lib/router-api";

export default function WhyTooltip({
  messageId,
  fallbackModel,
}: {
  messageId: string;
  fallbackModel?: string | null;
}) {
  const { project } = useBuilder();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandMemory, setExpandMemory] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    setData(await fetchExplanation(project, messageId));
    setLoading(false);
  }, [messageId, project]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const model = data?.model ?? fallbackModel ?? null;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        setOpen(false);
        setExpandMemory(false);
        setShowModel(false);
      }}
    >
      <button
        type="button"
        aria-label="Why this output"
        className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-muted-foreground hover:border-[#a855f7]/40 hover:text-[#c084fc]"
      >
        <HelpCircle className="h-2.5 w-2.5" /> why
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-[320px] rounded-lg border border-white/10 bg-[#0b0b11]/97 p-2.5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          {loading ? (
            <div className="grid h-14 place-items-center text-[10.5px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
          ) : (
            <>
              <p className="mb-2 text-[10.5px] leading-relaxed text-foreground/85">
                {data?.why ?? "Explainability record abhi save nahi hua (bridge pending)."}
              </p>

              {model && (
                <button
                  type="button"
                  onClick={() => setShowModel((v) => !v)}
                  className="mb-2 inline-flex items-center gap-1 rounded border border-[#60a5fa]/30 bg-[#60a5fa]/10 px-1.5 py-[2px] text-[9px] font-semibold uppercase tracking-wider text-[#93c5fd]"
                >
                  {shortModelTag(model)}
                </button>
              )}
              {showModel && (
                <div className="mb-2 rounded border border-white/[0.06] bg-white/[0.02] p-1.5 text-[10px] text-muted-foreground">
                  <div className="font-mono text-[9.5px] text-foreground/80">{model}</div>
                  {data?.modelReason && <div className="mt-0.5">{data.modelReason}</div>}
                  <div className="mt-0.5">
                    {(data?.tokensIn ?? 0).toLocaleString()} in ·{" "}
                    {(data?.tokensOut ?? 0).toLocaleString()} out
                    {typeof data?.costUsd === "number" ? ` · ${formatUsd(data.costUsd)}` : ""}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setExpandMemory((v) => !v)}
                className="mb-1 inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <Brain className="h-3 w-3" /> memory · {data?.memory.length ?? 0}
              </button>
              {expandMemory && (data?.memory.length ?? 0) > 0 && (
                <ul className="mb-2 space-y-1">
                  {data!.memory.map((m) => (
                    <li
                      key={m.id}
                      className="rounded border border-white/[0.06] bg-white/[0.02] p-1.5"
                    >
                      <div className="text-[10px] font-medium text-foreground/90">{m.title}</div>
                      <div className="mt-0.5 line-clamp-2 text-[9.5px] text-muted-foreground">
                        {m.snippet}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {(data?.tools.length ?? 0) > 0 && (
                <div className="mb-2">
                  <div className="mb-1 inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Wrench className="h-3 w-3" /> tools
                  </div>
                  <ul className="space-y-0.5">
                    {data!.tools.map((t) => (
                      <li key={t.id} className="flex items-center gap-1.5 text-[10px]">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            t.status === "ok"
                              ? "bg-emerald-400"
                              : t.status === "error"
                                ? "bg-[#E50914]"
                                : "bg-sky-400"
                          }`}
                        />
                        <span className="font-mono text-foreground/85">{t.name}</span>
                        {t.duration_ms !== null && (
                          <span className="text-muted-foreground/70">{t.duration_ms}ms</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(data?.chain.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    decision chain
                  </div>
                  <ol className="relative space-y-1 border-l border-white/10 pl-3">
                    {data!.chain.map((s) => (
                      <li key={s.id} className="relative">
                        <span
                          className="absolute -left-[17px] top-[5px] h-2 w-2 rounded-full"
                          style={{
                            background: stepTone(s.kind),
                            boxShadow: `0 0 8px ${stepTone(s.kind)}`,
                          }}
                        />
                        <div className="text-[10px] font-medium text-foreground/90">{s.label}</div>
                        {s.detail && (
                          <div className="text-[9.5px] leading-relaxed text-muted-foreground">
                            {s.detail}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </span>
  );
}
