---
name: Phase 11.2 + 11.3 LOCKED — Daily Standup + Compliance Badge
description: Standup chat panel (Jimmy Roman Urdu + 6 stats + issues + pause/quota) and Compliance badge (GDPR/spam/unsubscribe/Sherlock stamp) shipped; tables outreach_campaigns/standups/compliance
type: feature
---

# Phase 11.2 + 11.3 — shipped Aug 8 2026

Frontend (Lovable repo):
- `src/lib/outreach-api.ts` (extended, no duplicate file) — `fetchStandup`, `computeStats`,
  `setCampaignStatus`, `increaseQuota`, `subscribeStandup`, `fetchCompliance`,
  `subscribeCompliance`, `spamTone` (<3 green · 3-5 amber · >5 red), `complianceTone`.
- `src/components/builder/panels/StandupPanel.tsx` — Jimmy bubble (Roman Urdu, real row),
  6 stats cards (scraped/qualified/sent/replies/demos/closed), issue highlight
  (critical/warning/info), Pause↔Resume campaign + Increase quota +50 (real Supabase 3 writes).
- `src/components/builder/ComplianceBadge.tsx` — GDPR pill, spam score band, unsubscribe ✅/❌,
  Sherlock approval stamp + notes. Also exports `CompliancePill` + `useCompliance`.
- Registered ONCE: `builder-state.ts` BottomTabId `standup`, rail item `standup` (CalendarClock),
  `tab-registry.tsx` kind `standup`, `SidePanelDrawer` → `StandupRailPanel` (Open in Workspace).

SQL: `hetzner-migrations/20260813000000_phase_112_113_standup_compliance.sql`
(outreach_campaigns, outreach_standups, outreach_compliance — grants + RLS + realtime, idempotent).

Engine side (Hetzner, founder manual): Jimmy inserts `outreach_standups` after each outreach
cycle; Sherlock inserts `outreach_compliance`. Frontend never sends email or calls providers.
