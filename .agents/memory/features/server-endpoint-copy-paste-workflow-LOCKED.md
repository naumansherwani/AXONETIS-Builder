---
name: Server Endpoint Copy-Paste Workflow LOCKED
description: Founder workflow rule: for backend endpoint wiring, provide exact TypeScript server code blocks for founder to copy and run manually; do not modify server repo.
type: preference
---

# AXONETIS Founder Lock — Server Endpoint Copy-Paste Workflow

From now on, when backend endpoint wiring is needed for `hostflowai-server`, Lovable must:

1. **Write exact TypeScript endpoint code** for the founder to copy into his server repo.
2. Keep it **terminal/copy-paste ready** when possible.
3. Include the **exact route path, method, request body, query params, and response JSON shape**.
4. Match the frontend contract in `src/lib/hostflow-api.ts` unless founder changes it.
5. Never touch or assume direct access to `hostflowai-server`.
6. Never run server SQL or server commands unless founder explicitly confirms server is ready.
7. Do not give vague architecture only — give implementation code that founder can paste and run.

Reason: Founder has been stuck on Phase 3 endpoint confusion; endpoint contract clarity and copy-paste TypeScript is now mandatory.