/**
 * Phase 3.10.3 — Monaco side-by-side diff view (bare, no chrome).
 * Shared by MonacoDiffModal (single file) and DiffApprovalModal (batch review)
 * so the Monaco lazy-import lives in exactly one place.
 */
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const DiffEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.DiffEditor })),
);

export default function MonacoDiffView({
  oldValue,
  newValue,
  language,
}: {
  oldValue: string;
  newValue: string;
  language?: string;
}) {
  return (
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
  );
}
