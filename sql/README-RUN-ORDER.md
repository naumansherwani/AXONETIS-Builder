# AXONETIS™ — SQL run order (founder)

## Galti jo hui (root cause)

`rpc.routes.ts` ka **TypeScript** code SQL runner mein paste hua tha →
`ERROR: 42601: syntax error at or near "//"`.
Woh file **SQL nahi hai**. Uski jagah:

```
/var/www/axonetis/src/routes/rpc.routes.ts   (server file — psql mein NEVER)
```

Repo mein already maujood: `server-snippets/rpc.routes.ts`. Bas copy karo,
psql mein mat daalo.

## Saari pending SQL — ek command

```bash
cd /var/www/axonetis && git pull && bash sql/run-all-founder.sh
```

Password chahiye ho to:

```bash
AXONETIS_DB_URL='postgresql://postgres:APNA_PASSWORD@127.0.0.1:5432/postgres' \
  bash sql/run-all-founder.sh
```

## Order (script isi order mein chalati hai)

| # | File | Phase |
|---|------|-------|
| 1 | phase-01-foundation/20260612000001_phase1_foundation.sql | 1 |
| 2 | phase-01-foundation/20260612000002_add_builder_admin_email.sql | 1 |
| 3 | phase-03-agents/20260711000000_phase_3_agent_base.sql | 3 |
| 4 | phase-3.9-.../20260711000001_phase_393_394_publish_power_tools.sql | 3.9.3 + 3.9.4 |
| 5 | phase-3.9-.../20260711000002_phase_396_397_marketplace_router.sql | 3.9.6 + 3.9.7 |
| 6 | phase-3.10-intelligence/20260801000000_phase_3103b_agent_diffs.sql | 3.10.3-B |
| 7 | phase-3.10-intelligence/20260806000000_phase_3102_planning_tree.sql | 3.10.2 |
| 8 | phase-3.10-intelligence/20260808000000_phase_3102_self_verify.sql | 3.10.2 |
| 9 | phase-3.10-intelligence/20260809000000_phase_3108_lsp_diagnostics.sql | 3.10.8 |
| 10 | phase-3.10-intelligence/20260810000000_phase_3102_subagent_delegation.sql | 3.10.2 |
| 11 | phase-3.10-intelligence/20260811000000_phase_31010_supabase3_canonical.sql | 3.10.10 |
| 12 | phase-10-advantage/20260815000000_phase_101_103_replay_voice.sql | 10.1–10.3 |
| 13 | phase-10-advantage/20260816000000_phase_104_1015.sql | 10.4–10.15 |
| 14 | phase-10-advantage/20260816000001_phase_10_hard_heal.sql | 10 heal |
| 15 | phase-11-outreach/20260812000000_phase_11_outreach_leads.sql | 11.1 |
| 16 | phase-11-outreach/20260813000000_phase_112_113_standup_compliance.sql | 11.2–11.3 |
| 17 | phase-12-final-lock/20260814000000_phase_12_settings_help.sql | 12.1 + 12.3 |

Aakhir mein `VERIFY_phase_10.sql` chalti hai — **0 rows MISSING** expected.

`sql/founder/legacy-phase-03-06/` **NAHI** chalani — woh purane duplicate hain,
phase-03 + 3.9 files unko replace kar chuki hain.

## Rule

- `.sql` file → psql / SQL runner
- `.ts` / `.js` / `.sh` file → repo mein file, psql mein kabhi nahi
