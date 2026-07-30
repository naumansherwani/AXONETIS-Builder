/**
 * Phase 3.10.3 — Diff decision API (single source of truth).
 * Frontend never applies code itself: it only posts the founder's verdict to
 * Hetzner, which performs the write + git commit.
 *
 * Contract:
 *   POST /api/agents/diff/decision  { diff_id, decision }
 *   POST /api/agents/diff/decision  { diff_ids: string[], decision }  (bulk)
 */

export type DiffDecision = "approve" | "reject";

const ENDPOINT = "/api/agents/diff/decision";

async function post(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.warn("[diff-api] decision post failed", err);
    return false;
  }
}

/** Single-file decision. Returns false when the server endpoint is unavailable. */
export function postDiffDecision(diffId: string, decision: DiffDecision) {
  return post({ diff_id: diffId, decision });
}

/** Bulk decision for the Diff Approval modal. Ignores diffs without a diff_id. */
export function postDiffDecisionBatch(diffIds: string[], decision: DiffDecision) {
  const ids = diffIds.filter(Boolean);
  if (ids.length === 0) return Promise.resolve(false);
  return post({ diff_ids: ids, decision });
}
