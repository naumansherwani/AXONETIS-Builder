/**
 * Phase 10.6 — AI Test Generator client.
 *
 * Bridge endpoints (server-snippets/tests.routes.ts):
 *   GET  /rpc/tests.list?projectId              → { files, coverage, runs }
 *   POST /rpc/tests.generate { projectId, path } → { ok, files }
 *   POST /rpc/tests.run      { projectId, file? }→ TestRun
 */
import { rpc } from "./power-tools-api";

export type TestStatus = "pass" | "fail" | "pending" | "running";

export interface TestFile {
  id: string;
  path: string;
  origin: "generated" | "manual";
  status: TestStatus;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number | null;
  updated_at: string;
}

export interface TestRunPoint {
  at: string;
  passed: number;
  failed: number;
  actor: "sherlock" | "founder";
}

export interface TestSuiteState {
  files: TestFile[];
  coverage: number; // 0..100
  runs: TestRunPoint[];
}

export interface TestRun {
  ok: boolean;
  files: TestFile[];
  coverage: number;
  error?: string;
}

export async function fetchTestSuite(projectId: string): Promise<TestSuiteState | null> {
  return rpc<TestSuiteState>(`/rpc/tests.list?projectId=${encodeURIComponent(projectId)}`);
}

export async function generateTests(
  projectId: string,
  path: string,
): Promise<{ ok: boolean; files?: TestFile[]; error?: string } | null> {
  return rpc(`/rpc/tests.generate`, {
    method: "POST",
    body: JSON.stringify({ projectId, path }),
  });
}

export async function runTests(projectId: string, file?: string): Promise<TestRun | null> {
  return rpc<TestRun>(`/rpc/tests.run`, {
    method: "POST",
    body: JSON.stringify({ projectId, file: file ?? null }),
  });
}

export function statusTone(status: TestStatus): { label: string; className: string } {
  switch (status) {
    case "pass":
      return {
        label: "PASS",
        className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
      };
    case "fail":
      return { label: "FAIL", className: "border-[#E50914]/40 bg-[#E50914]/10 text-[#ff7480]" };
    case "running":
      return { label: "RUN", className: "border-sky-400/30 bg-sky-400/10 text-sky-300" };
    default:
      return { label: "IDLE", className: "border-white/10 bg-white/[0.04] text-muted-foreground" };
  }
}
