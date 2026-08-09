/**
 * Phase 10.4 — Screenshot Vision panel.
 * Drag-drop zone → upload progress → element map overlay → numbered AI suggestions
 * with one-click apply (creates a diff for the Phase 3.10.3 approval modal).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImageUp, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { PanelSection } from "./PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import {
  analyzeShot,
  applySuggestion,
  elementColor,
  isSupportedImage,
  listShots,
  uploadShot,
  VISION_MAX_BYTES,
  type VisionAnalysis,
  type VisionShot,
} from "@/lib/vision-api";

export default function VisionPanel() {
  const { project } = useBuilder();
  const [shots, setShots] = useState<VisionShot[]>([]);
  const [active, setActive] = useState<VisionShot | null>(null);
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [hoverEl, setHoverEl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const rows = await listShots(project);
    setShots(rows);
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!isSupportedImage(file)) {
        setError("Sirf PNG / JPG / WEBP / GIF / AVIF chalega.");
        return;
      }
      if (file.size > VISION_MAX_BYTES) {
        setError("File 8 MB se badi hai.");
        return;
      }
      setProgress(1);
      const shot = await uploadShot(project, file, (p) => setProgress(p));
      setProgress(null);
      if (!shot) {
        setError("Upload fail — bridge offline ya /rpc/vision.upload pending.");
        return;
      }
      setShots((s) => [shot, ...s.filter((x) => x.id !== shot.id)]);
      setActive(shot);
      setAnalysis(null);
    },
    [project],
  );

  const runAnalyze = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    setError(null);
    const res = await analyzeShot(project, active.id);
    setBusy(false);
    if (!res) {
      setError("Analyze fail — /rpc/vision.analyze pending ya model timeout.");
      return;
    }
    setAnalysis(res);
  }, [active, project]);

  const onApply = useCallback(
    async (suggestionId: string) => {
      if (!active) return;
      setApplied((a) => ({ ...a, [suggestionId]: false }));
      const res = await applySuggestion(project, active.id, suggestionId);
      if (res?.ok) setApplied((a) => ({ ...a, [suggestionId]: true }));
      else setError(res?.error ?? "Apply fail — /rpc/vision.apply pending.");
    },
    [active, project],
  );

  return (
    <div>
      <PanelSection
        title="Upload"
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            aria-label="Refresh screenshots"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        }
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") inputRef.current?.click();
          }}
          className={`grid cursor-pointer place-items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-all ${
            dragOver
              ? "border-[#E50914]/70 bg-[#E50914]/[0.07] shadow-[0_0_36px_-12px_rgba(229,9,20,0.85)]"
              : "border-white/15 hover:border-[#E50914]/40 hover:bg-white/[0.03] hover:shadow-[0_0_28px_-14px_rgba(229,9,20,0.6)]"
          }`}
        >
          <ImageUp className={`h-5 w-5 ${dragOver ? "text-[#ff7480]" : "text-muted-foreground"}`} />
          <div className="text-[11.5px] font-medium text-foreground/90">
            Screenshot drag-drop karo
          </div>
          <div className="text-[10px] text-muted-foreground">PNG · JPG · WEBP — max 8 MB</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.currentTarget.value = "";
            }}
          />
        </div>

        {progress !== null && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#E50914] to-[#ff7480] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
              {progress}%
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-[10.5px] leading-relaxed text-[#ff7480]">{error}</p>}
      </PanelSection>

      {shots.length > 0 && (
        <PanelSection title={`Screenshots · ${shots.length}`}>
          <div className="grid grid-cols-3 gap-1.5">
            {shots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActive(s);
                  setAnalysis(null);
                }}
                className={`overflow-hidden rounded border ${
                  active?.id === s.id
                    ? "border-[#E50914]/60 ring-1 ring-[#E50914]/40"
                    : "border-white/[0.08] hover:border-white/20"
                }`}
                title={s.filename}
              >
                {s.url ? (
                  <img src={s.url} alt={s.filename} className="h-14 w-full object-cover" />
                ) : (
                  <span className="grid h-14 w-full place-items-center bg-black/50 text-[9px] text-muted-foreground">
                    no preview
                  </span>
                )}
              </button>
            ))}
          </div>
        </PanelSection>
      )}

      {active && (
        <PanelSection
          title="Element map"
          action={
            <button
              type="button"
              onClick={() => void runAnalyze()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded border border-[#E50914]/30 bg-[#E50914]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#ff7480] hover:bg-[#E50914]/15 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              analyze
            </button>
          }
        >
          <div className="relative overflow-hidden rounded border border-white/[0.08] bg-black/60">
            {active.url ? (
              <img src={active.url} alt={active.filename} className="block w-full" />
            ) : (
              <div className="grid h-32 place-items-center text-[11px] text-muted-foreground">
                image URL missing
              </div>
            )}
            {analysis?.elements.map((el, i) => (
              <div
                key={el.id}
                onMouseEnter={() => setHoverEl(el.id)}
                onMouseLeave={() => setHoverEl(null)}
                className="absolute cursor-default rounded-[3px] transition-all"
                style={{
                  left: `${el.x * 100}%`,
                  top: `${el.y * 100}%`,
                  width: `${el.w * 100}%`,
                  height: `${el.h * 100}%`,
                  border: `1.5px solid ${elementColor(i)}`,
                  background: `${elementColor(i)}1a`,
                  boxShadow: hoverEl === el.id ? `0 0 22px -4px ${elementColor(i)}` : "none",
                }}
              >
                <span
                  className="absolute -top-[9px] left-0 rounded px-1 font-mono text-[8px] leading-[10px] text-black"
                  style={{ background: elementColor(i) }}
                >
                  {el.label}
                </span>
              </div>
            ))}
          </div>
          {analysis?.summary && (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {analysis.summary}
            </p>
          )}
        </PanelSection>
      )}

      {analysis && analysis.suggestions.length > 0 && (
        <PanelSection title={`AI suggestions · ${analysis.suggestions.length}`}>
          <ol className="space-y-1.5">
            {analysis.suggestions.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2"
                onMouseEnter={() => setHoverEl(s.elementId)}
                onMouseLeave={() => setHoverEl(null)}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#E50914]/15 font-mono text-[9px] text-[#ff7480]">
                    {s.index}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-medium text-foreground/95">{s.title}</div>
                    <div className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                      {s.detail}
                    </div>
                    {s.path && (
                      <div className="mt-1 font-mono text-[9.5px] text-muted-foreground/70">
                        {s.path}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void onApply(s.id)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${
                      applied[s.id]
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "border-white/12 bg-white/[0.04] text-foreground/85 hover:bg-white/[0.08]"
                    }`}
                  >
                    {applied[s.id] ? <Check className="h-3 w-3" /> : <Wand2 className="h-3 w-3" />}
                    {applied[s.id] ? "queued" : "apply"}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </PanelSection>
      )}
    </div>
  );
}
