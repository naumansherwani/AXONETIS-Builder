/**
 * Phase 3.10.8 — shared diagnostics hook.
 * One source for the CodePanel squiggles and the StatusBar Problems badge.
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchDiagnostics,
  runDiagnosticsScan,
  subscribeDiagnostics,
  type DiagnosticsSnapshot,
} from "@/lib/lsp-api";
import type { ProjectId } from "@/lib/projects";

const EMPTY: DiagnosticsSnapshot = {
  live: false,
  diagnostics: [],
  errorCount: 0,
  warningCount: 0,
  scannedAt: null,
};

export function useDiagnostics(projectId: ProjectId) {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    return fetchDiagnostics(projectId).then((s) => {
      setSnapshot(s);
      setLoading(false);
      return s;
    });
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchDiagnostics(projectId).then((s) => {
      if (!alive) return;
      setSnapshot(s);
      setLoading(false);
    });
    const unsub = subscribeDiagnostics(projectId, () => {
      void fetchDiagnostics(projectId).then((s) => {
        if (alive) setSnapshot(s);
      });
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [projectId]);

  const scan = useCallback(
    async (path?: string) => {
      setScanning(true);
      setError(null);
      try {
        const s = await runDiagnosticsScan(projectId, path);
        setSnapshot(s);
        return s;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setScanning(false);
      }
    },
    [projectId],
  );

  return { ...snapshot, loading, scanning, error, scan, reload };
}
