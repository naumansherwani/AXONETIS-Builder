---
name: Additive-only tech policy LOCKED (no touch existing)
description: Purane phases apni purani tech (Express /rpc + SSE + Realtime) pe hi chalenge aur wahi call karenge; NEW phases nayi tech (tRPC + WebTransport) pe banenge aur sirf apni layer call karenge. Koi migration/refactor/rewrite nahi.
type: constraint
---

# LOCKED — Aug 8 2026 (founder order)

## Rule
1. **Jo phases complete ho chuke hain — unko kabhi touch nahi karna.** Woh
   purani tech par hi chalenge: plain Express `/rpc/*` JSON routes, SSE over
   HTTP, Supabase 3 Realtime, `src/lib/*-api.ts` fetch clients.
   Un phases ka har call bhi wahi purani layer se hi jayega.
2. **NEW phases (3.11+) nayi tech par banenge** — typed tRPC router + client,
   WebTransport streaming (SSE fallback ke saath) — aur woh **sirf apni nayi
   layer** call karenge.
3. Dono layers **side-by-side** chalengi. Old routes ko tRPC mein "wrap" karna,
   rename karna, proxy karna, ya SSE hataana — **sab mana hai**.
4. Naya kaam sirf **naye files/mount paths** par: e.g. bridge par
   `app.use("/trpc", appRouter)` (naya file), frontend par naya
   `src/lib/trpc/*`. Existing `src/index.ts` ke purane `app.use("/rpc", ...)`
   lines chhedni nahi hain — sirf ek nayi mount line add hoti hai.
5. Refactor/"cleanup"/"unify" ka proposal dobara nahi dena. Duplicate nahi —
   **do generations**, purani frozen, nayi aage badhti hui.

## Why
Founder ne pehle din tech batayi thi; migration ki koshish ne credits aur waqt
zaya kiya aur working phases toote. Frozen-old + new-on-new pattern se kuch
nahi tootta.

## Frozen (old-gen, working, DO NOT TOUCH)
3.9.x publish/power-tools/marketplace/cost-router, 3.10.1 tool registry+abort,
3.10.2 Planning Tree / Self-Verify / Delegation / orchestration join,
3.10.3 + 3.10.3-B diff approval. Bridge `:8090` `/rpc/*`, Brain `:8080`
`/api/founder/*`, Builder `:3000`.

## New-gen starts at Phase 3.11
`/trpc/*` typed router (naya file) + WebTransport stream channel. Old phases
usko call nahi karenge, aur naye phases `/rpc/*` ko call nahi karenge.
