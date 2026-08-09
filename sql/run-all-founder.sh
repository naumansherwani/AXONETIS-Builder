#!/usr/bin/env bash
# ============================================================
# AXONETIS™ — run ALL founder SQL migrations in correct order
# Hetzner:  cd /var/www/axonetis && git pull && bash sql/run-all-founder.sh
#
# Sab files idempotent hain -> dobara chalane se kuch nahi tootta.
# Sirf .sql files chalti hain. VERIFY_* aur legacy-* skip.
#
# DB URL detect order:
#   1) $AXONETIS_DB_URL
#   2) $SUPABASE3_DB_URL (agar db.*.supabase.co na ho)
#   3) postgresql://postgres@127.0.0.1:5432/postgres  (local peer/trust)
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB="${AXONETIS_DB_URL:-}"
if [ -z "$DB" ] && [ -n "${SUPABASE3_DB_URL:-}" ] && [[ "${SUPABASE3_DB_URL}" != *"db."*".supabase.co"* ]]; then
  DB="$SUPABASE3_DB_URL"
fi
[ -z "$DB" ] && DB="postgresql://postgres@127.0.0.1:5432/postgres"

echo "== DB target: ${DB%%\?*}"
if ! psql "$DB" -tAc 'select 1' >/dev/null 2>&1; then
  echo "!! DB connect fail. Apna asli URL do:"
  echo "   AXONETIS_DB_URL='postgresql://postgres:PASSWORD@127.0.0.1:5432/postgres' bash sql/run-all-founder.sh"
  exit 1
fi

# Exact run order — phase by phase, no mix, no duplicate.
FILES=(
  sql/founder/phase-01-foundation/20260612000001_phase1_foundation.sql
  sql/founder/phase-01-foundation/20260612000002_add_builder_admin_email.sql
  sql/founder/phase-03-agents/20260711000000_phase_3_agent_base.sql
  sql/founder/phase-3.9-publish-power-marketplace/20260711000001_phase_393_394_publish_power_tools.sql
  sql/founder/phase-3.9-publish-power-marketplace/20260711000002_phase_396_397_marketplace_router.sql
  sql/founder/phase-3.10-intelligence/20260801000000_phase_3103b_agent_diffs.sql
  sql/founder/phase-3.10-intelligence/20260806000000_phase_3102_planning_tree.sql
  sql/founder/phase-3.10-intelligence/20260808000000_phase_3102_self_verify.sql
  sql/founder/phase-3.10-intelligence/20260809000000_phase_3108_lsp_diagnostics.sql
  sql/founder/phase-3.10-intelligence/20260810000000_phase_3102_subagent_delegation.sql
  sql/founder/phase-3.10-intelligence/20260811000000_phase_31010_supabase3_canonical.sql
  sql/founder/phase-10-advantage/20260815000000_phase_101_103_replay_voice.sql
  sql/founder/phase-10-advantage/20260816000000_phase_104_1015.sql
  sql/founder/phase-10-advantage/20260816000001_phase_10_hard_heal.sql
  sql/founder/phase-11-outreach/20260812000000_phase_11_outreach_leads.sql
  sql/founder/phase-11-outreach/20260813000000_phase_112_113_standup_compliance.sql
  sql/founder/phase-12-final-lock/20260814000000_phase_12_settings_help.sql
)

FAIL=0
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "-- SKIP (missing): $f"
    continue
  fi
  printf '== RUN %s ... ' "$f"
  if out="$(psql "$DB" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1)"; then
    echo "OK"
  else
    echo "FAIL"
    echo "$out" | tail -n 20
    FAIL=1
  fi
done

echo
echo "== VERIFY Phase 10 (expected: 0 rows MISSING)"
psql "$DB" -f sql/founder/phase-10-advantage/VERIFY_phase_10.sql 2>&1 | grep -i 'MISSING' || echo "no MISSING rows"

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL SQL GREEN ✅"; else echo "Kuch file fail hui — upar ka FAIL block bhejo ❌"; fi
exit "$FAIL"
