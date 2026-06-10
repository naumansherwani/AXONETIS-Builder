/**
 * OPTION C — WORDMARK ONLY
 * Pure typography. JetBrains Mono. Gradient shimmer reacts to agent state.
 */
import { motion } from "framer-motion";
import type { AgentState } from "@/lib/builder-state";

export default function Wordmark({ state = "standby" }: { state?: AgentState }) {
  const gradient =
    state === "jimmy"
      ? "linear-gradient(90deg, #fff 0%, #E50914 50%, #fff 100%)"
      : state === "sherlock"
      ? "linear-gradient(90deg, #fff 0%, #a855f7 50%, #fff 100%)"
      : "linear-gradient(90deg, #6a6a74 0%, #ffffff 50%, #6a6a74 100%)";

  return (
    <motion.span
      className="select-none text-[18px] font-semibold uppercase"
      style={{
        fontFamily: "'JetBrains Mono','Geist Mono',ui-monospace,monospace",
        letterSpacing: "0.18em",
        backgroundImage: gradient,
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
      animate={{ backgroundPosition: ["-100% 0", "100% 0"] }}
      transition={{ duration: state === "standby" ? 4 : 2, repeat: Infinity, ease: "linear" }}
    >
      f·os
    </motion.span>
  );
}
