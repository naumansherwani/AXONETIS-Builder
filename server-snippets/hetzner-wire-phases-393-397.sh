#!/usr/bin/env bash
set -Eeuo pipefail

# AXONETIS™ — one-command Hetzner wiring for phases 3.9.3 → 3.9.7.
# Run as root on Hetzner after this repo has the latest git pull.
# No manual nano/edit required.

BUILDER_DIR="${BUILDER_DIR:-/var/www/axonetis}"
ENGINE_DIR="${ENGINE_DIR:-/var/www/NEXATECT-Engine}"
DOMAIN="${AXONETIS_DOMAIN:-https://aiaxonetis.hostflowai.net}"
RPC_FILE="$ENGINE_DIR/server/routes/rpc.routes.ts"
PHASE_396_FILE="$ENGINE_DIR/server/routes/rpc-phase-396-397.additions.ts"
STAMP="$(date +%Y%m%d%H%M%S)"

log() { printf '\n\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33mWARN: %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
backup() { [ -f "$1" ] && cp "$1" "$1.bak-$STAMP"; }

require_file() { [ -f "$1" ] || die "Missing file: $1"; }
require_dir() { [ -d "$1" ] || die "Missing directory: $1"; }

log "0) Paths verify"
require_dir "$BUILDER_DIR"
require_dir "$ENGINE_DIR"
require_file "$BUILDER_DIR/hetzner-migrations/20260711000001_phase_393_394_publish_power_tools.sql"
require_file "$BUILDER_DIR/hetzner-migrations/20260711000002_phase_396_397_marketplace_router.sql"
require_file "$BUILDER_DIR/server-snippets/rpc.routes.ts"
require_file "$BUILDER_DIR/server-snippets/rpc-phase-396-397.additions.ts"
require_file "$BUILDER_DIR/server-snippets/preview-visual-edit-bridge.js"

log "1) Latest builder repo pull"
cd "$BUILDER_DIR"
git pull --ff-only || warn "git pull failed/dirty tree — continuing with current files"

log "2) DB migrations apply on Supabase 3"
[ -n "${SUPABASE3_DB_URL:-}" ] || die "SUPABASE3_DB_URL env missing. Export it, then rerun."
psql "$SUPABASE3_DB_URL" -v ON_ERROR_STOP=1 -f "$BUILDER_DIR/hetzner-migrations/20260711000001_phase_393_394_publish_power_tools.sql"
psql "$SUPABASE3_DB_URL" -v ON_ERROR_STOP=1 -f "$BUILDER_DIR/hetzner-migrations/20260711000002_phase_396_397_marketplace_router.sql"

log "3) DB verify"
psql "$SUPABASE3_DB_URL" -v ON_ERROR_STOP=1 -c "select count(*) as marketplace_agents from public.marketplace_agents;"
psql "$SUPABASE3_DB_URL" -v ON_ERROR_STOP=1 -c "select column_name from information_schema.columns where table_schema='public' and table_name='agent_thread_messages' and column_name in ('cost_usd','saved_vs_default_usd','default_model') order by column_name;"

log "4) Wire /rpc routes in NEXATECT-Engine — NO duplicate router"
mkdir -p "$ENGINE_DIR/server/routes"
if [ ! -f "$RPC_FILE" ]; then
  cp "$BUILDER_DIR/server-snippets/rpc.routes.ts" "$RPC_FILE"
  log "Installed rpc.routes.ts because it did not exist"
elif ! grep -q "publish.state" "$RPC_FILE" || ! grep -q "sql.validate" "$RPC_FILE"; then
  backup "$RPC_FILE"
  cp "$BUILDER_DIR/server-snippets/rpc.routes.ts" "$RPC_FILE"
  log "Replaced incomplete rpc.routes.ts with phase 3.9.3/3.9.4 complete router (backup kept)"
else
  log "Existing rpc.routes.ts already has phase 3.9.3/3.9.4 endpoints"
fi

cp "$BUILDER_DIR/server-snippets/rpc-phase-396-397.additions.ts" "$PHASE_396_FILE"

node --input-type=module - "$RPC_FILE" <<'NODE'
import fs from "node:fs";
const file = process.argv[2];
let src = fs.readFileSync(file, "utf8");

if (!src.includes('rpc-phase-396-397.additions')) {
  const importLine = 'import { registerRouterAndMarketplaceRoutes } from "./rpc-phase-396-397.additions";\n';
  const importMatches = [...src.matchAll(/^import .*$/gm)];
  if (importMatches.length) {
    const last = importMatches.at(-1);
    src = src.slice(0, last.index + last[0].length) + "\n" + importLine + src.slice(last.index + last[0].length);
  } else {
    src = importLine + src;
  }
}

if (!src.includes('registerRouterAndMarketplaceRoutes(router')) {
  const client = /\bsupabase3\s+as\s+supabase\b|\bconst\s+supabase\b|\bsupabase\s*=/.test(src) ? "supabase" : "supabase3";
  const call = `\n// Phase 3.9.6 + 3.9.7 — marketplace + global router (auto-wired, no duplicate router)\nregisterRouterAndMarketplaceRoutes(router, ${client});\n`;
  if (src.includes("export default router")) {
    src = src.replace(/\nexport default router\s*;?/, `${call}\nexport default router;`);
  } else {
    src += call;
  }
}

fs.writeFileSync(file, src);
NODE

log "5) Visual Edit bridge inject into preview apps/templates"
for root in "$BUILDER_DIR" "$ENGINE_DIR" /var/www/hostflowai /var/www/rapidpay /var/www/hostflow-server /opt/hostflow-ecosystem/hostflow-server; do
  [ -d "$root" ] || continue
  mkdir -p "$root/public"
  cp "$BUILDER_DIR/server-snippets/preview-visual-edit-bridge.js" "$root/public/axonetis-preview-bridge.js"
  while IFS= read -r html; do
    [ -f "$html" ] || continue
    if ! grep -q "axonetis-preview-bridge.js" "$html"; then
      backup "$html"
      perl -0pi -e 's#</body>#  <script src="/axonetis-preview-bridge.js" defer></script>\n</body>#i' "$html" || true
    fi
  done < <(find "$root" -maxdepth 4 -type f \( -name "index.html" -o -name "*.html" \) 2>/dev/null | head -50)
done

log "6) Stop button abort wiring verify"
AGENTS_ROUTE="$BUILDER_DIR/src/routes/api/agents.\$slug.chat.ts"
if [ -f "$AGENTS_ROUTE" ]; then
  grep -q "signal: request.signal" "$AGENTS_ROUTE" || die "Builder agents chat route is missing request.signal wiring. Pull latest axonetis repo and rerun."
  log "Builder TanStack /api/agents/:slug/chat has request.signal wired"
else
  warn "Builder TanStack agents route not found at $AGENTS_ROUTE — skipping local grep verify"
fi

log "7) Engine pull/install/restart"
cd "$ENGINE_DIR"
git pull --ff-only || warn "Engine git pull failed/dirty tree — continuing with current files"
bun install
if [ -f package.json ] && node -e 'const p=require("./package.json"); process.exit(p.scripts&&p.scripts.build?0:1)' 2>/dev/null; then
  bun run build
fi
pm2 restart hostflowai-brain --update-env || pm2 restart all --update-env

log "8) Builder install/build/restart"
cd "$BUILDER_DIR"
bun install
bun run build
pm2 restart axonetis-builder --update-env

log "9) Smoke tests — real endpoints"
set +e
echo "-- router.preview"
curl -fsS -X POST "$DOMAIN/rpc/router.preview" -H 'content-type: application/json' -d '{"prompt":"fix button color","agent":"jimmy"}' ; echo
ROUTER_STATUS=$?

echo "-- marketplace.list count"
MARKET_JSON="$(curl -fsS "$DOMAIN/rpc/marketplace.list")"
MARKET_STATUS=$?
printf '%s\n' "$MARKET_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s); console.log(Array.isArray(j.agents)?j.agents.length:"bad_json")}catch(e){console.log("bad_json")}})'

echo "-- publish.state endpoint"
curl -sS "$DOMAIN/rpc/publish.state?projectId=founderbuilder" ; echo

echo "-- sql.validate endpoint"
curl -sS -X POST "$DOMAIN/rpc/sql.validate" -H 'content-type: application/json' -d '{"projectId":"founderbuilder","query":"select 1"}' ; echo
set -e

if [ "$ROUTER_STATUS" -ne 0 ] || [ "$MARKET_STATUS" -ne 0 ]; then
  warn "Smoke test failed. Check PM2 logs below."
  pm2 logs hostflowai-brain --lines 40 --nostream || true
  pm2 logs axonetis-builder --lines 40 --nostream || true
  exit 1
fi

log "✅ SERVER-SIDE LIVE: phases 3.9.3 → 3.9.7 wired, migrated, restarted, smoke-tested"
pm2 logs axonetis-builder --lines 20 --nostream || true