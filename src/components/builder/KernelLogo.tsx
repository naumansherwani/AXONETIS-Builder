/**
 * KERNEL HEXA-GRID — Live OS identity glyph for Founder AI Builder™.
 * [ ⬢ // F-OS ] — abstract geometric mark whose color reflects live system state.
 *
 * States:
 *   - standby  : ambient carbon-gray breathing
 *   - jimmy    : crimson red shimmer (Qwen 480B coding)
 *   - sherlock : amethyst violet glow (DeepSeek R1 auditing)
 *
 * Typography: JetBrains Mono, 10px, UPPERCASE, 0.2em tracking — kernel hardware panel feel.
 */
import { motion } from "framer-motion";

export type AgentState = "standby" | "jimmy" | "sherlock";

const PALETTE: Record<AgentState, { stroke: string; fill: string; glow: string; label: string }> = {
  standby:  { stroke: "#3a3a44", fill: "#1a1a20", glow: "rgba(180,180,200,0.10)", label: "F-OS" },
  jimmy:    { stroke: "#E50914", fill: "#2a0306", glow: "rgba(229,9,20,0.55)",    label: "JIMMY" },
  sherlock: { stroke: "#a855f7", fill: "#1a0933", glow: "rgba(168,85,247,0.55)",  label: "SHERLOCK" },
};

interface Props {
  state?: AgentState;
  size?: number;        // hexagon px
  showLabel?: boolean;  // [ ⬢ // F-OS ] frame
}

export default function KernelLogo({ state = "standby", size = 18, showLabel = true }: Props) {
  const c = PALETTE[state];
  const pulsing = state !== "standby";

  return (
    <div
      className="inline-flex select-none items-center gap-1.5"
      style={{ fontFamily: "'JetBrains Mono','Geist Mono',ui-monospace,monospace" }}
    >
      {showLabel && <Bracket side="left" color={c.stroke} />}

      {/* Hexagon core — animated */}
      <motion.svg
        width={size}
        height={size * 1.08}
        viewBox="0 0 24 26"
        animate={
          pulsing
            ? { filter: [`drop-shadow(0 0 2px ${c.glow})`, `drop-shadow(0 0 8px ${c.glow})`, `drop-shadow(0 0 2px ${c.glow})`] }
            : { filter: [`drop-shadow(0 0 1px ${c.glow})`, `drop-shadow(0 0 4px ${c.glow})`, `drop-shadow(0 0 1px ${c.glow})`] }
        }
        transition={{ duration: pulsing ? 1.4 : 3.6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <polygon
          points="12,1 22,7 22,19 12,25 2,19 2,7"
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* inner micro-grid */}
        <polygon
          points="12,6 18,9.5 18,16.5 12,20 6,16.5 6,9.5"
          fill="none"
          stroke={c.stroke}
          strokeOpacity={pulsing ? 0.85 : 0.5}
          strokeWidth="0.6"
        />
        <line x1="12" y1="6" x2="12" y2="20" stroke={c.stroke} strokeOpacity="0.35" strokeWidth="0.5" />
      </motion.svg>

      {showLabel && (
        <>
          <span className="text-[10px] font-medium" style={{ color: c.stroke, letterSpacing: "0.2em" }}>
            //
          </span>
          <span
            className="text-[10px] font-medium uppercase"
            style={{ color: c.stroke, letterSpacing: "0.2em" }}
          >
            {c.label}
          </span>
          <Bracket side="right" color={c.stroke} />
        </>
      )}
    </div>
  );
}

function Bracket({ side, color }: { side: "left" | "right"; color: string }) {
  return (
    <span
      className="text-[12px] font-light"
      style={{ color, opacity: 0.7, transform: side === "right" ? "scaleX(-1)" : undefined }}
    >
      [
    </span>
  );
}
