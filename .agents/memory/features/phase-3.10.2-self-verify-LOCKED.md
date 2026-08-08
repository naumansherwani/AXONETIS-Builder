---
name: Phase 3.10.2 sub-step 2 — Self-Verify Loop SHIPPED
description: Sherlock self-verification loop UI (SelfVerifyLoop.tsx) + verify.routes.ts bridge snippet + agent_verifications SQL shipped Aug 8 2026, after Planning Tree green (plan.create:400 route live, SQL applied).
type: feature
---

# Phase 3.10.2 — sub-step 2 Self-Verify Loop (LOCKED Aug 8 2026)

Pre-req green: sub-step 1 Planning Tree — SQL applied (`agent_plans`,
`agent_plan_nodes`) + `/rpc/plan.create` live (400 threadId required).

## Frontend (this repo)
- NEW `src/components/builder/SelfVerifyLoop.tsx` — Sherlock violet #a855f7 card:
  per-check rows (logic/security/performance/build/test icons), status dots,
  progress bar, attempt pips (`pass n/max`), fix_summary footer.
- `src/lib/agent-stream.ts` — `extractStructured` now returns `verifications`;
  `parseVerificationPart` parses `{ type: "verification", verify_id, target,
  agent, attempt, max_attempts, status, verdict, fix_summary, checks[] }`.
- `src/lib/project-workspace.ts` — `ChatMsg.verifications?: VerificationPart[]`.
- `src/components/builder/UnifiedChat.tsx` — renders SelfVerifyLoop between
  PlanningTree and ToolCallBubble. Zero dummy.

## Server (founder copy-paste)
- `server-snippets/verify.routes.ts` is the Lovable-repo source only. Hetzner
  destination path is **not assumed**; first verify hostname, repo root,
  entrypoint and PM2 process. Then send the complete route as a heredoc/full-file
  overwrite and mount `app.use("/rpc", verifyRouter)`. Routes: `verify.start`,
  `verify.check.update`, `verify.attempt`, `verify.finish`, `verify.get`.
  Every write re-emits the `verification` part on the thread message (Realtime).
- SQL: `hetzner-migrations/20260808000000_phase_3102_self_verify.sql`
  (`agent_verifications`, `agent_verification_checks`, grants + RLS, idempotent).

## Next sub-step (3.10.2)
3. Sub-agent delegation — `SubAgentTimeline.tsx` + dependency DAG.

## Deployment correction — LOCKED Aug 8 2026
- Failed assumptions: `/root/hostflow-server` and `/var/www/axonetis` did not
  exist on founder's current `ubuntu-4gb-hel1-1` host.
- Never repeat guessed-path commands. Founder has multiple machines.
- Required order: read-only discovery → founder returns output → Lovable sends
  complete SQL/file/script blocks → founder only copy-pastes → smoke test green.
- Sub-step 3 remains blocked until SQL + bridge + builder are verified on the
  correct host.
