/**
 * Code panel — lightweight code viewer (Monaco-class polish lands in later phase).
 * Phase 2: read-only preview with line numbers + simple token tinting.
 */
import { PanelSection } from "./PanelChrome";

const SAMPLE = `// src/components/Hero.tsx
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl font-bold tracking-tight"
      >
        Run your business on autopilot.
      </motion.h1>
    </section>
  );
}`;

export default function CodePanel() {
  const lines = SAMPLE.split("\n");
  return (
    <PanelSection title="Hero.tsx" action={<span className="font-mono text-[10px] text-muted-foreground/60">read-only</span>}>
      <div className="rounded-md border border-white/[0.06] bg-black/50 p-2">
        <pre className="fb-no-scrollbar max-h-[55vh] overflow-auto font-mono text-[11px] leading-relaxed">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-3 hover:bg-white/[0.03]">
              <span className="w-6 select-none text-right text-muted-foreground/40">{i + 1}</span>
              <code className="text-foreground/85">{l || " "}</code>
            </div>
          ))}
        </pre>
      </div>
    </PanelSection>
  );
}
