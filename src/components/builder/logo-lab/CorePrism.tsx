/**
 * OPTION B — CORE PRISM
 * Isometric cube, 3 faces = Founder / Jimmy / Sherlock. Active agent face lights up.
 */
import { motion } from "framer-motion";
import type { AgentState } from "@/lib/builder-state";

const FACE = {
  founder: "#e8e8ee",
  jimmy: "#E50914",
  sherlock: "#a855f7",
};

export default function CorePrism({ state = "standby", size = 26 }: { state?: AgentState; size?: number }) {
  const dim = "#26262e";
  const top = state === "standby" ? FACE.founder : dim;
  const left = state === "jimmy" ? FACE.jimmy : dim;
  const right = state === "sherlock" ? FACE.sherlock : dim;
  const stroke = "#3a3a44";
  const label = state === "jimmy" ? FACE.jimmy : state === "sherlock" ? FACE.sherlock : FACE.founder;

  return (
    <div
      className="inline-flex select-none items-center gap-2"
      style={{ fontFamily: "'JetBrains Mono','Geist Mono',ui-monospace,monospace" }}
    >
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        animate={{ filter: [`drop-shadow(0 0 2px ${label}55)`, `drop-shadow(0 0 8px ${label}99)`, `drop-shadow(0 0 2px ${label}55)`] }}
        transition={{ duration: state === "standby" ? 3.4 : 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* top face */}
        <polygon points="20,4 34,12 20,20 6,12" fill={top} stroke={stroke} strokeWidth="0.8" />
        {/* left face */}
        <polygon points="6,12 20,20 20,36 6,28" fill={left} stroke={stroke} strokeWidth="0.8" />
        {/* right face */}
        <polygon points="34,12 20,20 20,36 34,28" fill={right} stroke={stroke} strokeWidth="0.8" />
      </motion.svg>
      <span
        className="text-[11px] font-medium uppercase"
        style={{ color: label, letterSpacing: "0.2em" }}
      >
        [F·OS]
      </span>
    </div>
  );
}
