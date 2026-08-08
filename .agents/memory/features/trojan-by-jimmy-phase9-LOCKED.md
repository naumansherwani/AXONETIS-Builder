---
name: TROJAN BY JIMMY (Phase 9 CRM) LOCKED
description: Phase 9 ka hissa — TROJAN BY JIMMY = zero-entry autonomous CRM (Attract/Nurture/Close/Retain), situation-based model routing, TROJAN_SYSTEM prompt in brain config/models.ts, SQL spans Supabase 1 + Supabase 3.
type: feature
---

# TROJAN BY JIMMY — Phase 9 (LOCKED)

Salesforce ke ulta: manual entry / forms / reports / sales reps / £150 per user ki jagah —
**zero entry**, email se khud data, Jimmy 24/7 monitor, real-time deal health, khud alert.

## 4 stages (Jimmy autonomous loop)
1. **ATTRACT** — company analyze (industry, size, employees) → personalized pitch email, pain points address, NEXATECT solution explain.
2. **NURTURE** — 72h silence detect → auto follow-up draft, behaviour aware ("pricing page visit ki"), warm not pushy.
3. **CLOSE** — deal ≥80% → Sherlock audit → risk flags → Jimmy closing email + clear terms.
4. **RETAIN** — customer banne ke baad: monthly value report, upsell hunt, problem se pehle detect.

## Model routing (situation → model)
| Situation | Model |
|---|---|
| First outreach | `claude-sonnet-4-6` (warmth, persuasive) |
| Deal analysis / risk | `deepseek-r1` |
| Quick reply / chat | `deepseek-v4-flash` |
| Legal / contract | `claude-sonnet-4-6` |
| Silence detected | `deepseek-r1` + `claude-sonnet-4-6` (analyze → craft) |
| Bulk outreach / campaign | `gpt-oss-120b` |

Routing source of truth remains `agent_registry.routing_config` (Supabase 3) — never hardcode in app code.
Brain-side situation map lives in `/opt/hostflowai-brain/backend/src/config/models.ts`.

## TROJAN_SYSTEM prompt (LIVE on brain, appended to config/models.ts)
Jimmy John = NEXATECT Supreme Commander in Trojan mode = business intelligence weapon.
- Har prospect ka business samjho (industry, size, pain points)
- Human-jaise emails, corporate robot nahi
- Poora NEXATECT ecosystem explain karo; attract, force nahi — value dikhao
- Deal health 24/7 monitor; loop holes detect karo; wahan NEXATECT solution present karo

Email style: warm + direct, intro 3 lines max · pain point pehle, solution baad · social proof with real numbers · ek hi clear CTA · never pushy.

Products to pitch: **ANEXOMAIL** £20–85/mo (email workspace) · **AXONETIS** AI Builder (coming soon) · **ANEXVOT Pay** · **AI Add-on** £135–2000/mo.

Rule: *Awam ki marzi unki — Jimmy sirf value dikhata hai.*

## Data layer
- SQL spans **Supabase 1** (CRM/business data: contacts, companies, deals, email threads, activity)
  and **Supabase 3** (agent side: threads, activity, tool_call_registry, routing_config).
- No duplicate tables — extend existing agent tables in Supabase 3, CRM tables in Supabase 1.

## Enforcement
- Trojan = Phase 9 only. Phase 3.10.x frozen (additive-only tech policy) — Trojan built on new files/paths.
- Never re-open model routing here; DB wins.
