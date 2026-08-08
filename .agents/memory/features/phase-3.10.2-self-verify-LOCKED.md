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
- `server-snippets/verify.routes.ts` → `/root/hostflow-server/src/routes/verify.routes.ts`,
  mount `app.use("/rpc", verifyRouter)`. Routes: `verify.start`,
  `verify.check.update`, `verify.attempt`, `verify.finish`, `verify.get`.
  Every write re-emits the `verification` part on the thread message (Realtime).
- SQL: `hetzner-migrations/20260808000000_phase_3102_self_verify.sql`
  (`agent_verifications`, `agent_verification_checks`, grants + RLS, idempotent).

## Next sub-step (3.10.2)
3. Sub-agent delegation — `SubAgentTimeline.tsx` + dependency DAG.
