/**
 * OPTION A — PULSE NODE
 * Single glowing core + 2 concentric radar rings. Apple Vision Pro / Neuralink feel.
 */
import { motion } from "framer-motion";
import type { AgentState } from "@/lib/builder-state";

const C: Record<AgentState, { core: string; ring: string; glow: string }> = {
  standby: { core: "#e8e8ee", ring: "#8a8a96", glow: "rgba(232,232,238,0.35)" },
  jimmy: { core: "#E50914", ring: "#E50914", glow: "rgba(229,9,20,0.6)" },
  sherlock: { core: "#a855f7", ring: "#a855f7", glow: "rgba(168,85,247,0.6)" },
};

export default function PulseNode({
  state = "standby",
  size = 22,
}: {
  state?: AgentState;
  size?: number;
}) {
  const c = C[state];
  const active = state !== "standby";
  return (
    <div
      className="inline-flex select-none items-center gap-2"
      style={{ fontFamily: "'JetBrains Mono','Geist Mono',ui-monospace,monospace" }}
    >
      <div className="relative" style={{ width: size * 2, height: size * 2 }}>
        {/* outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: c.ring }}
          animate={
            active
              ? { scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }
              : { opacity: [0.18, 0.3, 0.18] }
          }
          transition={{ duration: active ? 1.6 : 3.6, repeat: Infinity, ease: "easeOut" }}
        />
        {/* middle ring */}
        <motion.div
          className="absolute rounded-full border"
          style={{
            inset: size * 0.4,
            borderColor: c.ring,
          }}
          animate={
            active
              ? { scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }
              : { opacity: [0.35, 0.55, 0.35] }
          }
          transition={{
            duration: active ? 1.6 : 3.6,
            repeat: Infinity,
            ease: "easeOut",
            delay: 0.3,
          }}
        />
        {/* core */}
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: size * 0.75,
            background: c.core,
            boxShadow: `0 0 ${active ? 14 : 8}px ${c.glow}`,
          }}
          animate={{ opacity: active ? [1, 0.7, 1] : [0.85, 1, 0.85] }}
          transition={{ duration: active ? 1.2 : 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <span
        className="text-[11px] font-medium uppercase"
        style={{ color: c.core, letterSpacing: "0.2em" }}
      >
        F·OS
      </span>
    </div>
  );
}
