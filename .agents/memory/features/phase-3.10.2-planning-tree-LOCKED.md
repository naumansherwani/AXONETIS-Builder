---
name: Phase 3.10.2 sub-step 1 — Planning Tree SHIPPED
description: Sherlock audit 200 OK (Brain live, OPENROUTER key wired) unblocked Rule #9. Planning Tree frontend + plan.routes.ts snippet + agent_plans/agent_plan_nodes SQL shipped Aug 6 2026.
type: feature
---

# Phase 3.10.2 — sub-step 1 Planning Tree (LOCKED Aug 6 2026)

Unblocker: `POST /api/founder/sherlock/audit` → **200 OK** with real 3-pass verdict
(model deepseek-r1). Brain env fixed via `pm2 set hostflowai-brain:OPENAI_API_KEY` +
`OPENAI_BASE_URL=https://openrouter.ai/api/v1`. Rule #9 satisfied.

## Frontend (this repo)
- NEW `src/components/builder/PlanningTree.tsx` — collapsible Goal → Task/Verify/Subagent
  tree, per-node status dot (pending/running/done/failed/skipped), progress bar,
  kind accents: task = red #E50914, verify = violet #a855f7, subagent = cyan #22d3ee.
- `src/lib/agent-stream.ts` — `extractStructured` now returns `plans` and parses
  `{ type: "plan", plan_id, goal, status, nodes[] }` parts (`parsePlanPart`). Zero dummy.
- `src/lib/project-workspace.ts` — `ChatMsg.plans?: PlanPart[]`.
- `src/components/builder/UnifiedChat.tsx` — renders PlanningTree above tool bubbles.

## Server (founder copy-paste)
- `server-snippets/plan.routes.ts` → `/root/hostflow-server/src/routes/plan.routes.ts`,
  mount `app.use("/rpc", planRouter)`. Routes: `plan.create`, `plan.node.update`,
  `plan.status`, `plan.get`. Every write re-emits the `plan` part on the thread message
  so Supabase 3 Realtime refreshes the tree (no polling).
- SQL: `hetzner-migrations/20260806000000_phase_3102_planning_tree.sql`
  (`agent_plans`, `agent_plan_nodes`, grants + RLS, idempotent).

## Next sub-steps (3.10.2)
2. Self-verification loop UI (`SelfVerifyLoop.tsx`, `parts[].type === "verification"`)
3. Sub-agent delegation (`SubAgentTimeline.tsx` + dependency DAG)
