/**
 * VoiceWaveform — cinematic live audio meter while founder holds the mic.
 * Consumes an AnalyserNode (Web Audio API), draws bars via requestAnimationFrame.
 * Zero DOM churn — canvas only.
 */
import { useEffect, useRef } from "react";

export default function VoiceWaveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !analyser) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    const BARS = 24;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);

      const gap = 2;
      const barW = (w - gap * (BARS - 1)) / BARS;
      const step = Math.floor(bufferLength / BARS);
      for (let i = 0; i < BARS; i++) {
        const v = data[i * step] / 255;
        const barH = Math.max(2, v * h * 0.9);
        const x = i * (barW + gap);
        const y = (h - barH) / 2;
        // red glow gradient
        const g = ctx.createLinearGradient(0, y, 0, y + barH);
        g.addColorStop(0, "rgba(229, 9, 20, 0.95)");
        g.addColorStop(1, "rgba(229, 9, 20, 0.55)");
        ctx.fillStyle = g;
        ctx.shadowColor = "rgba(229, 9, 20, 0.55)";
        ctx.shadowBlur = 6;
        ctx.fillRect(x, y, barW, barH);
      }
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, active]);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-full mb-2 flex items-center gap-2 rounded-lg border border-[#E50914]/30 bg-black/70 px-3 py-2 backdrop-blur-md">
      <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#E50914] shadow-[0_0_10px_#E50914]" />
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-[#ff7480]">Recording</span>
      <canvas ref={canvasRef} width={280} height={28} className="flex-1" />
    </div>
  );
}
