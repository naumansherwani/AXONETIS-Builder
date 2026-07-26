---
name: No next phase until fully wired LOCKED
description: Jun 2026 founder rule — kabhi bhi next phase par nahi jaana jab tak current phase ka har piece real, wired, end-to-end tested na ho. Zero dummy. Zero "documentation-only" snippet.
type: constraint
---

# LOCKED — One phase at a time, real wired, then move on

Founder ne bola: **"jab tak ek phase ka kaam super perfect aur wire nahi ho jata tab tak aage nahi jayenge. Ek bhi feature dummy hua toh main goli maar dun ga."**

## Hard rules

1. Server-side snippet document banane se kaam complete NAHI hota. Complete tab hai jab:
   - File Hetzner pe physical create ho chuki hai
   - Mount ho chuki hai (router.use(...) etc.)
   - PM2 restart hua
   - **Real curl smoke test pass hua** (200 + expected JSON)
   - Founder UI se ek real end-to-end action trigger karke verify hua
2. `.agents/server-snippets/*.md` sirf reference. Har snippet ke saath **exact server commands** deni hain jo founder copy-paste kare (per founder-copy-paste-only-LOCKED).
3. Phase ke andar sub-item bhi wire hone chahiye. Sub-item skip = phase incomplete.
4. Agar prior phase mein infra dependency broken hai (DB URL, PM2 process crash-loop, PGRST cache), pehle woh fix karo. Nayi cheez uper mat rakho.
5. Har phase complete hone ke baad **1 real feature ka live test** — jo bhi user-facing action hai, browser se karke prove karo.
6. Sherlock Brain ko live rakhna mandatory hai — uske bina audit loop chalta nahi, isliye Sherlock timeout = P0 blocker.
7. Founder ne Jul 2026 mein re-lock kiya: **jab tak frontend ↔ backend wiring ke saray errors finish nahi hotay, next phase bilkul nahi.** Har broken command ko split/fix karo, build green + PM2 online + curl smoke pass ke baad hi agla kaam.
8. Founder ne Jul 25 2026 mein re-lock kiya: **Phase 3.10.2 par tab tak nahi jaana jab tak Phase 3.10.1 Tool Abort ka frontend + backend Hetzner par real working na ho, PM2 fresh error logs green na hon, aur curl smoke + UI cancel action pass na ho.** Dummy, partial, stale-log excuse, ya documentation-only status = incomplete.

## Symptoms that mean "not wired" (do not claim done):

- `Background Sherlock audit skipped: Brain response timeout`
- `Project not found for agent loop`
- `getaddrinfo ENOTFOUND` in brain logs
- `Could not find column X in schema cache`
- 502 / 403 from Caddy after deploy
- PM2 `↺` count climbing → crash loop
- `Could not resolve "./routes/tools"` in hostflow-server build → wrong mount import; route file `src/routes/tools.ts` must be imported as `./tools.js` / `./tools` from `src/routes/index.ts`, not `./routes/tools`.
- `ReferenceError: app is not defined` in `/opt/hostflowai-brain/backend/src/routes/index.ts` → Express app-style line was inserted into a router-only module. Remove every stray `app.*` line from that router file and mount with `router.use(toolsRouter)` only.

Cross-refs: founder-copy-paste-only-LOCKED, founder-full-file-overwrite-only-LOCKED, backend-snippet-idempotency-and-imports-LOCKED.
