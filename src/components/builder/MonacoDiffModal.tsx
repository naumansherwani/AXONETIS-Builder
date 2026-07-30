/**
 * Phase 3.9.5 — Monaco full-diff modal.
 * Opens from DiffPreview "Full diff" button for a side-by-side Monaco view.
 * Lazy-loaded — Monaco bundle only ships when the founder opens a diff.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X, FileDiff } from "lucide-react";
import MonacoDiffView from "./MonacoDiffView";


export default function MonacoDiffModal({
  open,
  onClose,
  path,
  oldValue,
  newValue,
  language,
}: {
  open: boolean;
  onClose: () => void;
  path: string;
  oldValue: string;
  newValue: string;
  language?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] grid place-items-center bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 90, damping: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="fb-glass relative flex h-[85vh] w-[min(1200px,96vw)] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#08080c] shadow-[0_30px_120px_-20px_rgba(124,58,237,0.5)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7c3aed] to-transparent" />
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FileDiff className="h-3.5 w-3.5 text-[#c4a8ff]" />
                <span className="font-mono text-[12px] text-foreground/90">{path}</span>
                {language && (
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                    {language}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Suspense
                fallback={
                  <div className="grid h-full place-items-center text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading Monaco…
                    </span>
                  </div>
                }
              >
                <DiffEditor
                  original={oldValue}
                  modified={newValue}
                  language={language ?? "typescript"}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                  }}
                />
              </Suspense>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
