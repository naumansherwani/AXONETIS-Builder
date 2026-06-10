/**
 * AXONET — THE SIGNAL MARK  (Autonomous · eXecution · Orchestration · Network)
 * ────────────────────────────────────────────────────────────────
 * A hexagonal synapse: six dendrites fire inward to a glowing core.
 * Geometric, processor-like, unmistakably AI. Not a Meta loop, not a
 * letter — a physics object.
 *
 * Reacts to live agent state (standby / jimmy / sherlock).
 * Built for 16px favicon → 1024px hero. viewBox is padded so the
 * outer halo never clips in a tight parent.
 */
import { motion } from "framer-motion";
import type { AgentState } from "@/lib/builder-state";

const PALETTE: Record<AgentState, { core: string; fiber: string; glow: string; halo: string }> = {
  standby:  { core: "#ffffff", fiber: "#9aa6c4", glow: "rgba(180,200,255,0.55)", halo: "rgba(180,200,255,0.16)" },
  jimmy:    { core: "#ffd9dc", fiber: "#E50914", glow: "rgba(229,9,20,0.75)",    halo: "rgba(229,9,20,0.20)"   },
  sherlock: { core: "#efe0ff", fiber: "#a855f7", glow: "rgba(168,85,247,0.75)",  halo: "rgba(168,85,247,0.20)" },
};

// 6 hex vertices on a circle of radius 38 around (50,50)
const VERTS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2; // start at top
  return [50 + 38 * Math.cos(a), 50 + 38 * Math.sin(a)] as const;
});
const HEX_PATH =
  "M " + VERTS.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ") + " Z";

interface Props {
  state?: AgentState;
  size?: number;
  /** Show "AXONET" wordmark to the right of the glyph */
  wordmark?: boolean;
  /** Force the wordmark color */
  textColor?: string;
}

export default function AxenMark({ state = "standby", size = 40, wordmark = false, textColor }: Props) {
  const c = PALETTE[state];
  const active = state !== "standby";
  const pulseDur = active ? 1.6 : 3.2;

  return (
    <div className="inline-flex select-none items-center" style={{ gap: size * 0.35 }}>
      <motion.svg
        width={size}
        height={size}
        viewBox="-8 -8 116 116"
        style={{ overflow: "visible" }}
        aria-label="Axen"
        animate={{
          filter: [
            `drop-shadow(0 0 ${size * 0.04}px ${c.glow})`,
            `drop-shadow(0 0 ${size * 0.20}px ${c.glow})`,
            `drop-shadow(0 0 ${size * 0.04}px ${c.glow})`,
          ],
        }}
        transition={{ duration: pulseDur * 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Outer halo ring */}
        <motion.circle
          cx="50" cy="50" r="48"
          fill="none"
          stroke={c.fiber}
          strokeWidth="0.6"
          animate={{ strokeOpacity: active ? [0.12, 0.45, 0.12] : [0.06, 0.18, 0.06] }}
          transition={{ duration: pulseDur, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Hex chassis */}
        <path d={HEX_PATH} fill="none" stroke={c.fiber} strokeOpacity="0.55" strokeWidth="1.4" strokeLinejoin="round" />

        {/* 6 dendrites: vertex → core */}
        {VERTS.map(([x, y], i) => (
          <line
            key={`d-${i}`}
            x1={x} y1={y} x2="50" y2="50"
            stroke={c.fiber}
            strokeOpacity="0.35"
            strokeWidth="1"
            strokeLinecap="round"
          />
        ))}

        {/* Vertex nodes */}
        {VERTS.map(([x, y], i) => (
          <circle key={`v-${i}`} cx={x} cy={y} r="2.2" fill={c.fiber} />
        ))}

        {/* Firing signal pulses — 3 alternating dendrites travel vertex → core */}
        {[0, 2, 4].map((i) => {
          const [x, y] = VERTS[i];
          return (
            <motion.circle
              key={`p-${i}`}
              r={active ? 2.6 : 2}
              fill={c.core}
              initial={false}
              animate={{
                cx: [x, 50],
                cy: [y, 50],
                opacity: active ? [0, 1, 0] : [0, 0.6, 0],
              }}
              transition={{
                duration: pulseDur,
                repeat: Infinity,
                ease: "easeIn",
                delay: (i / 6) * pulseDur,
              }}
            />
          );
        })}
        {[1, 3, 5].map((i) => {
          const [x, y] = VERTS[i];
          return (
            <motion.circle
              key={`p2-${i}`}
              r={active ? 2.6 : 2}
              fill={c.core}
              initial={false}
              animate={{
                cx: [x, 50],
                cy: [y, 50],
                opacity: active ? [0, 1, 0] : [0, 0.6, 0],
              }}
              transition={{
                duration: pulseDur,
                repeat: Infinity,
                ease: "easeIn",
                delay: (i / 6) * pulseDur,
              }}
            />
          );
        })}

        {/* Synapse core — the heart */}
        <motion.circle
          cx="50" cy="50" r="7"
          fill={c.halo}
          animate={{ r: active ? [6, 10, 6] : [5.5, 7.5, 5.5], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: pulseDur, repeat: Infinity, ease: "easeInOut" }}
        />
        <circle cx="50" cy="50" r="3.2" fill={c.core} />
      </motion.svg>

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
          AXONET
        </span>
      )}
    </div>
  );
}
