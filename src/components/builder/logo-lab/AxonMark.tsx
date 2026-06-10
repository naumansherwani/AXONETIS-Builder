/**
 * AXON — THE SIGNAL MARK
 * ────────────────────────────────────────────────────────────────
 * The "X" is not a letter. It is two axons crossing at a synapse.
 * Two organic neural fibers arc across a perfect circle, meet at a
 * glowing core, and fire pulses outward — the literal act of one
 * autonomous agent talking to another.
 *
 * Built to be unforgettable at 16px and monumental at 1024px.
 * Reacts to live agent state (standby / jimmy / sherlock).
 */
import { motion } from "framer-motion";
import type { AgentState } from "@/lib/builder-state";

const PALETTE: Record<AgentState, { core: string; fiber: string; glow: string; halo: string }> = {
  standby:  { core: "#ffffff", fiber: "#9aa0b4", glow: "rgba(180,200,255,0.55)", halo: "rgba(180,200,255,0.18)" },
  jimmy:    { core: "#ffd9dc", fiber: "#E50914", glow: "rgba(229,9,20,0.75)",    halo: "rgba(229,9,20,0.22)"   },
  sherlock: { core: "#efe0ff", fiber: "#a855f7", glow: "rgba(168,85,247,0.75)",  halo: "rgba(168,85,247,0.22)" },
};

interface Props {
  state?: AgentState;
  size?: number;
  /** Show "AXON" wordmark to the right of the glyph */
  wordmark?: boolean;
  /** Force the wordmark color (defaults to fiber color) */
  textColor?: string;
}

export default function AxonMark({ state = "standby", size = 40, wordmark = false, textColor }: Props) {
  const c = PALETTE[state];
  const active = state !== "standby";

  // Pulse cadence: slow & meditative in standby, sharp & alive when an agent fires.
  const pulseDur = active ? 1.6 : 3.2;

  return (
    <div className="inline-flex select-none items-center" style={{ gap: size * 0.35 }}>
      {/* GLYPH */}
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-label="Axon"
        animate={{
          filter: [
            `drop-shadow(0 0 ${size * 0.04}px ${c.glow})`,
            `drop-shadow(0 0 ${size * 0.18}px ${c.glow})`,
            `drop-shadow(0 0 ${size * 0.04}px ${c.glow})`,
          ],
        }}
        transition={{ duration: pulseDur * 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Outer halo ring — the boundary of the agent's "field" */}
        <circle cx="50" cy="50" r="46" fill="none" stroke={c.fiber} strokeOpacity="0.18" strokeWidth="0.8" />
        <motion.circle
          cx="50" cy="50" r="46"
          fill="none"
          stroke={c.fiber}
          strokeWidth="0.6"
          animate={{ strokeOpacity: active ? [0.15, 0.55, 0.15] : [0.08, 0.2, 0.08] }}
          transition={{ duration: pulseDur, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* AXON FIBER 1 — top-left → bottom-right (organic S-curve) */}
        <path
          id="axon-a"
          d="M 8 24 C 28 18, 38 38, 50 50 C 62 62, 72 82, 92 76"
          fill="none"
          stroke={c.fiber}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* AXON FIBER 2 — top-right → bottom-left (mirrored S-curve) */}
        <path
          id="axon-b"
          d="M 92 24 C 72 18, 62 38, 50 50 C 38 62, 28 82, 8 76"
          fill="none"
          stroke={c.fiber}
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Dendrite tips — tiny terminal nodes at all 4 endpoints */}
        {[
          [8, 24], [92, 24], [92, 76], [8, 76],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.8" fill={c.fiber} />
        ))}

        {/* SIGNAL PULSES — bright dot travels along each fiber */}
        <motion.circle
          r={active ? 2.8 : 2.2}
          fill={c.core}
          animate={{ opacity: active ? [0, 1, 1, 0] : [0, 0.7, 0.7, 0] }}
          transition={{ duration: pulseDur, repeat: Infinity, ease: "easeInOut", times: [0, 0.15, 0.85, 1] }}
        >
          <animateMotion dur={`${pulseDur}s`} repeatCount="indefinite" rotate="auto">
            <mpath href="#axon-a" />
          </animateMotion>
        </motion.circle>
        <motion.circle
          r={active ? 2.8 : 2.2}
          fill={c.core}
          animate={{ opacity: active ? [0, 1, 1, 0] : [0, 0.7, 0.7, 0] }}
          transition={{ duration: pulseDur, repeat: Infinity, ease: "easeInOut", times: [0, 0.15, 0.85, 1], delay: pulseDur / 2 }}
        >
          <animateMotion dur={`${pulseDur}s`} begin={`${pulseDur / 2}s`} repeatCount="indefinite" rotate="auto">
            <mpath href="#axon-b" />
          </animateMotion>
        </motion.circle>

        {/* SYNAPSE CORE — the heart, where signals meet */}
        <motion.circle
          cx="50" cy="50"
          r="5.5"
          fill={c.halo}
          animate={{ r: active ? [5, 8, 5] : [4.5, 6, 4.5], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: pulseDur, repeat: Infinity, ease: "easeInOut" }}
        />
        <circle cx="50" cy="50" r="2.6" fill={c.core} />
      </motion.svg>

      {/* WORDMARK */}
      {wordmark && (
        <span
          className="font-semibold uppercase"
          style={{
            fontFamily: "'Geist Mono','JetBrains Mono',ui-monospace,monospace",
            fontSize: size * 0.55,
            letterSpacing: "0.32em",
            color: textColor ?? "#f4f4f8",
            textShadow: active ? `0 0 ${size * 0.4}px ${c.glow}` : `0 0 ${size * 0.2}px ${c.glow}`,
          }}
        >
          AXON
        </span>
      )}
    </div>
  );
}
