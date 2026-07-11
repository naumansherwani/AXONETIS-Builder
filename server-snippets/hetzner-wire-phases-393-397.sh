#!/usr/bin/env bash
set -Eeuo pipefail

# AXONETIS™ — one-command Hetzner wiring for phases 3.9.3 → 3.9.7.
# No manual nano/edit required. Safe re-run: creates backups and avoids duplicate route mounts.

BUILDER_DIR="${BUILDER_DIR:-/var/www/axonetis}"
DOMAIN="${AXONETIS_DOMAIN:-https://aiaxonetis.hostflowai.net}"
STAMP="$(date +%Y%m%d%H%M%S)"

log() { printf '\n\033[1;36m%s\033[0m\n' "$*"; }
ok() { printf '\033[1;32mOK: %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33mWARN: %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
backup() { [ -f "$1" ] && cp "$1" "$1.bak-$STAMP"; }
require_file() { [ -f "$1" ] || die "Missing file: $1"; }
require_dir() { [ -d "$1" ] || die "Missing directory: $1"; }

node_available() { command -v node >/dev/null 2>&1; }

pm2_cwds() {
  node_available || return 0
  pm2 jlist 2>/dev/null | node -e '
let s="";
process.stdin.on("data", d => s += d).on("end", () => {
  try {
    const rows = JSON.parse(s);
    for (const p of rows) if (p?.pm2_env?.pm_cwd) console.log(p.pm2_env.pm_cwd);
  } catch {}
});' 2>/dev/null || true
}

route_dir_for() {
  local root="$1"
  if [ -d "$root/server/routes" ]; then printf '%s/server/routes' "$root"; return 0; fi
  if [ -d "$root/src/routes" ]; then printf '%s/src/routes' "$root"; return 0; fi
  if [ -d "$root/routes" ]; then printf '%s/routes' "$root"; return 0; fi
  if [ -f "$root/package.json" ]; then printf '%s/server/routes' "$root"; return 0; fi
  return 1
}

score_engine_dir() {
  local root="$1" score=0 rd=""
  [ -d "$root" ] || { echo 0; return; }
  [ -f "$root/package.json" ] && score=$((score + 10))
  rd="$(route_dir_for "$root" 2>/dev/null || true)"
  [ -n "$rd" ] && score=$((score + 15))
  [ -f "$rd/rpc.routes.ts" ] && score=$((score + 60))
  [ -f "$rd/preview.routes.ts" ] && score=$((score + 12))
  grep -Rqs "app\\.use *(.*[\"']/rpc" "$root/src" "$root/server" "$root/routes" 2>/dev/null && score=$((score + 40))
  grep -Rqs 'express *(' "$root/src" "$root/server" "$root/routes" "$root" 2>/dev/null && score=$((score + 10))
  case "$root" in
    */hostflow-server|*/hostflowai-brain/backend|*/hostflowai-brain|*/hostflow-engine) score=$((score + 8));;
  esac
  echo "$score"
}

detect_engine_dir() {
  if [ -n "${ENGINE_DIR:-}" ]; then
    case "$ENGINE_DIR" in
      /actual/path*|*/actual/path*) die "ENGINE_DIR placeholder diya hua hai. Real path use karo, e.g. ENGINE_DIR=/opt/hostflow-ecosystem/hostflow-server" ;;
    esac
    [ -d "$ENGINE_DIR" ] || die "Engine dir not found: $ENGINE_DIR"
    printf '%s' "$ENGINE_DIR"
    return 0
  fi

  local candidates=""
  candidates="$candidates
/opt/hostflow-ecosystem/hostflow-server
/opt/hostflowai-brain/backend
/opt/hostflowai-brain
/root/hostflow-engine
/opt/hostflow-brain
/opt/hostflow-backend
/var/www/NEXATECT-Engine
/var/www/nexatect-engine
/var/www/hostflowai-brain
/var/www/hostflow-server"
  candidates="$candidates
$(pm2_cwds)"

  local best="" best_score=0 cand score
  while IFS= read -r cand; do
    [ -n "$cand" ] || continue
    [ -d "$cand" ] || continue
    score="$(score_engine_dir "$cand")"
    if [ "$score" -gt "$best_score" ]; then
      best="$cand"
      best_score="$score"
    fi
  done < <(printf '%s\n' "$candidates" | awk '!seen[$0]++')

  [ -n "$best" ] && [ "$best_score" -ge 15 ] || die "Engine dir auto-detect failed. Valid PM2 cwd dekho: pm2 jlist | grep -o '\"pm_cwd\":\"[^\"]*\"' | sort -u"
  printf '%s' "$best"
}

detect_db_url() {
  node_available || return 0
  node - "$BUILDER_DIR" "$ENGINE_DIR" <<'NODE'
const fs = require("fs");
const path = require("path");
const [builderDir, engineDir] = process.argv.slice(2);
const envs = [];
envs.push(process.env);

function parseEnvFile(file) {
  const out = {};
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim().replace(/^export\s+/, "");
      let value = line.slice(idx + 1).trim();
      value = value.replace(/^['"]|['"]$/g, "");
      out[key] = value;
    }
  } catch {}
  return out;
}

for (const root of [builderDir, engineDir, "/opt/hostflowai-brain", "/opt/hostflowai-brain/backend", "/root/hostflow-engine", "/opt/hostflow-ecosystem/hostflow-server"]) {
  if (!root) continue;
  for (const name of [".env", ".env.local", ".env.production", ".env.prod"]) envs.push(parseEnvFile(path.join(root, name)));
}

try {
  const cp = require("child_process");
  const raw = cp.execFileSync("pm2", ["jlist"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const rows = JSON.parse(raw);
  const ordered = ["axonetis-builder", "hostflowai-brain", "hostflow-server", "aanris-runtime"];
  rows.sort((a, b) => ordered.indexOf(a.name) - ordered.indexOf(b.name));
  for (const p of rows) if (p?.pm2_env) envs.push(p.pm2_env);
} catch {}

const exact = [
  "AXONETIS_DB_URL", "BUILDER_DB_URL", "AXONETIS_POSTGRES_URL", "AXONETIS_DATABASE_URL",
  "HOSTFLOW_DB_URL", "HOSTFLOW_POSTGRES_URL", "LOCAL_DB_URL", "POSTGRES_URL", "POSTGRESQL_URL", "DATABASE_URL", "DIRECT_URL",
  "SUPABASE3_DB_URL", "SUPABASE_DB_URL"
];

function isPg(v) { return typeof v === "string" && /^postgres(ql)?:\/\//i.test(v); }
function usable(v) {
  if (!isPg(v)) return false;
  if (v.includes("...")) return false;
  if (/placeholder/i.test(v)) return false;
  // This builder is locked to founder self-hosted DB on Hetzner. Do not auto-pick old cloud pooler URLs.
  if (/\.supabase\.co/i.test(v)) return false;
  return true;
}

function buildFromParts(env) {
  const password = env.AXONETIS_DB_PASSWORD || env.POSTGRES_PASSWORD || env.POSTGRESQL_PASSWORD || env.DB_PASSWORD;
  if (!password || password.includes("...") || /placeholder/i.test(password)) return "";
  const user = env.AXONETIS_DB_USER || env.POSTGRES_USER || env.POSTGRESQL_USER || env.DB_USER || "postgres";
  const db = env.AXONETIS_DB_NAME || env.POSTGRES_DB || env.POSTGRESQL_DATABASE || env.DB_NAME || "postgres";
  const host = env.AXONETIS_DB_HOST || env.POSTGRES_HOST || env.POSTGRESQL_HOST || env.DB_HOST || "127.0.0.1";
  const port = env.AXONETIS_DB_PORT || env.POSTGRES_PORT || env.POSTGRESQL_PORT || env.DB_PORT || "5432";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(db)}`;
}

for (const env of envs) {
  for (const key of exact) if (usable(env[key])) { process.stdout.write(env[key]); process.exit(0); }
}

for (const env of envs) {
  const built = buildFromParts(env);
  if (usable(built)) { process.stdout.write(built); process.exit(0); }
}

for (const env of envs) {
  const entries = Object.entries(env).filter(([k, v]) => usable(v) && /(?:AXONETIS|BUILDER|HOSTFLOW|LOCAL|POSTGRES|DATABASE|DB).*URL/i.test(k));
  const preferred = entries.find(([k]) => /AXONETIS|BUILDER|HOSTFLOW|LOCAL/i.test(k)) || entries[0];
  if (preferred) { process.stdout.write(preferred[1]); process.exit(0); }
}
NODE
}

validate_db_url() {
  local value="$1"
  [ -n "$value" ] || return 1
  case "$value" in
    *...*|*placeholder*) die "AXONETIS_DB_URL placeholder hai. Actual self-hosted Postgres URL paste karo, 'postgresql://...' nahi." ;;
    *supabase.co*) die "Old cloud DB URL detect hua (*.supabase.co). AXONETIS self-hosted Hetzner Postgres URL do: AXONETIS_DB_URL='postgresql://USER:PASS@HOST:5432/DB'" ;;
    local-peer:*) return 0 ;;
    postgres://*|postgresql://*) return 0 ;;
    *) die "DB URL invalid hai. It must start with postgresql://USER:PASS@HOST:5432/DB" ;;
  esac
}

db_url_problem() {
  local value="$1"
  [ -n "$value" ] || { printf 'empty'; return 0; }
  case "$value" in
    *...*|*placeholder*) printf "placeholder value ('postgresql://...' real URL nahi hota)" ;;
    *supabase.co*) printf "old cloud URL (*.supabase.co), self-hosted Hetzner DB URL chahiye" ;;
    local-peer:*) ;;
    postgres://*|postgresql://*) ;;
    *) printf "not a postgresql:// URL" ;;
  esac
}

detect_local_peer_db() {
  command -v sudo >/dev/null 2>&1 || return 0
  command -v psql >/dev/null 2>&1 || return 0

  local candidates="${AXONETIS_DB_NAME:-} ${POSTGRES_DB:-} ${DB_NAME:-} axonetis_builder axonetis postgres"
  local db
  for db in $candidates; do
    [ -n "$db" ] || continue
    if sudo -n -u postgres psql -d "$db" -v ON_ERROR_STOP=1 -tAc 'select 1' >/dev/null 2>&1; then
      printf 'local-peer:%s' "$db"
      return 0
    fi
  done

  db="$(sudo -n -u postgres psql -d postgres -tAc "select datname from pg_database where datistemplate=false and datallowconn=true order by case when datname='postgres' then 0 when datname ilike '%axonetis%' then 1 else 2 end, datname limit 1" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ -n "$db" ] && sudo -n -u postgres psql -d "$db" -v ON_ERROR_STOP=1 -tAc 'select 1' >/dev/null 2>&1; then
    printf 'local-peer:%s' "$db"
  fi
}

select_db_url() {
  local key value reason

  # Founder-provided AXONETIS_* override always wins. This fixes old PM2 SUPABASE3_DB_URL shadowing.
  for key in AXONETIS_DB_URL BUILDER_DB_URL AXONETIS_POSTGRES_URL AXONETIS_DATABASE_URL HOSTFLOW_DB_URL HOSTFLOW_POSTGRES_URL LOCAL_DB_URL POSTGRES_URL POSTGRESQL_URL DATABASE_URL DIRECT_URL; do
    value="${!key:-}"
    [ -n "$value" ] || continue
    validate_db_url "$value"
    printf '%s' "$value"
    return 0
  done

  # Legacy names are accepted only if they are not the old cloud URL/placeholder.
  for key in SUPABASE3_DB_URL SUPABASE_DB_URL; do
    value="${!key:-}"
    [ -n "$value" ] || continue
    reason="$(db_url_problem "$value")"
    if [ -z "$reason" ]; then
      printf '%s' "$value"
      return 0
    fi
    warn "Ignoring $key: $reason"
  done

  value="$(detect_db_url || true)"
  if [ -n "$value" ]; then
    validate_db_url "$value"
    printf '%s' "$value"
    return 0
  fi

  value="$(detect_local_peer_db || true)"
  if [ -n "$value" ]; then
    warn "No usable DB URL found; using local postgres peer access on this Hetzner box."
    printf '%s' "$value"
  fi
}

ensure_supabase3_client() {
  local root="$1" route_dir="$2" target=""
  if grep -q 'integrations/supabase3/client' "$route_dir/rpc.routes.ts" 2>/dev/null; then
    local try_paths=(
      "$root/server/integrations/supabase3/client.ts"
      "$root/src/integrations/supabase3/client.ts"
      "$root/integrations/supabase3/client.ts"
    )
    for p in "${try_paths[@]}"; do [ -f "$p" ] && return 0; done
    case "$route_dir" in
      */server/routes) target="${route_dir%/routes}/integrations/supabase3/client.ts" ;;
      */src/routes) target="${route_dir%/routes}/integrations/supabase3/client.ts" ;;
      */routes) target="$root/integrations/supabase3/client.ts" ;;
      *) target="$root/server/integrations/supabase3/client.ts" ;;
    esac
    mkdir -p "$(dirname "$target")"
    cat > "$target" <<'TS'
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE3_URL ?? process.env.AXONETIS_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE3_SERVICE_ROLE_KEY ?? process.env.AXONETIS_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("supabase3 env missing: set SUPABASE3_URL + SUPABASE3_SERVICE_ROLE_KEY or AXONETIS_SUPABASE_URL + AXONETIS_SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase3 = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
TS
    ok "Created missing supabase3 client at $target"
  fi
}

run_psql() {
  local sql_arg="$1" mode="$2"
  set +e
  if [[ "$DB_URL" == local-peer:* ]]; then
    local peer_db="${DB_URL#local-peer:}"
    if [ "$mode" = "file" ]; then
      PSQL_OUT="$(sudo -n -u postgres psql -d "$peer_db" -v ON_ERROR_STOP=1 -f "$sql_arg" 2>&1)"
    else
      PSQL_OUT="$(sudo -n -u postgres psql -d "$peer_db" -v ON_ERROR_STOP=1 -c "$sql_arg" 2>&1)"
    fi
  elif [ "$mode" = "file" ]; then
    PSQL_OUT="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$sql_arg" 2>&1)"
  else
    PSQL_OUT="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$sql_arg" 2>&1)"
  fi
  local code=$?
  set -e
  if [ "$code" -ne 0 ]; then
    printf '%s\n' "$PSQL_OUT" >&2
    if printf '%s' "$PSQL_OUT" | grep -qi "could not translate host name\|Name or service not known"; then
      die "DB host resolve nahi ho raha. Yeh script server edit nahi karegi jab tak real Hetzner DB URL na ho. Run: AXONETIS_DB_URL='postgresql://USER:PASS@127.0.0.1:5432/DB' bash server-snippets/hetzner-wire-phases-393-397.sh"
    fi
    die "psql failed during DB migration/verify. Output above."
  fi
  printf '%s\n' "$PSQL_OUT"
}

find_server_entry() {
  local root="$1"
  grep -Rsl 'express *(' "$root/src" "$root/server" "$root/routes" "$root" 2>/dev/null \
    | grep -Ev 'node_modules|\.bak-|dist|build' \
    | head -1 || true
}

wire_rpc_mount() {
  local entry="$1" rpc_file="$2"
  [ -f "$entry" ] || { warn "Express entry not found — RPC file copied, mount verify skipped"; return 0; }
  if grep -q "app\\.use *(.*[\"']/rpc" "$entry" || grep -q 'rpc\.routes' "$entry"; then
    ok "RPC mount already present in $entry"
    return 0
  fi

  backup "$entry"
  node - "$entry" "$rpc_file" <<'NODE'
const fs = require("fs");
const path = require("path");
const [entry, rpcFile] = process.argv.slice(2);
let src = fs.readFileSync(entry, "utf8");
let rel = path.relative(path.dirname(entry), rpcFile).replace(/\\/g, "/");
if (!rel.startsWith(".")) rel = "./" + rel;
rel = rel.replace(/\.ts$/, ".js");
const importLine = `import rpcRouter from "${rel}";\n`;
const imports = [...src.matchAll(/^import .*$/gm)];
if (imports.length) {
  const last = imports.at(-1);
  src = src.slice(0, last.index + last[0].length) + "\n" + importLine + src.slice(last.index + last[0].length);
} else {
  src = importLine + src;
}

const appMatch = src.match(/(?:const|let|var)\s+(\w+)\s*=\s*express\s*\(/);
const app = appMatch?.[1] || "app";
const mount = `\n// AXONETIS phases 3.9.3 → 3.9.7 RPC endpoints (auto-wired, no duplicate)\n${app}.use("/rpc", rpcRouter);\n`;
if (/\n\s*\w+\.listen\s*\(/.test(src)) {
  src = src.replace(/\n\s*\w+\.listen\s*\(/, mount + "$&");
} else {
  src += mount;
}
fs.writeFileSync(entry, src);
NODE
  ok "Mounted /rpc in $entry"
}

restart_pm2_if_exists() {
  local name="$1"
  pm2 describe "$name" >/dev/null 2>&1 && pm2 restart "$name" --update-env || true
}

curl_json() {
  local method="$1" url="$2" body="${3:-}"
  if [ "$method" = "GET" ]; then
    curl -fsS --max-time 10 "$url"
  else
    curl -fsS --max-time 10 -X "$method" "$url" -H 'content-type: application/json' -d "$body"
  fi
}

log "0) Paths verify"
require_dir "$BUILDER_DIR"
ENGINE_DIR="$(detect_engine_dir)"
ROUTE_DIR="$(route_dir_for "$ENGINE_DIR")"
mkdir -p "$ROUTE_DIR"
RPC_FILE="$ROUTE_DIR/rpc.routes.ts"
PHASE_396_FILE="$ROUTE_DIR/rpc-phase-396-397.additions.ts"
log "Using ENGINE_DIR=$ENGINE_DIR"
log "Using ROUTE_DIR=$ROUTE_DIR"

require_file "$BUILDER_DIR/hetzner-migrations/20260711000001_phase_393_394_publish_power_tools.sql"
require_file "$BUILDER_DIR/hetzner-migrations/20260711000002_phase_396_397_marketplace_router.sql"
require_file "$BUILDER_DIR/server-snippets/rpc.routes.ts"
require_file "$BUILDER_DIR/server-snippets/rpc-phase-396-397.additions.ts"
require_file "$BUILDER_DIR/server-snippets/preview-visual-edit-bridge.js"
require_file "$BUILDER_DIR/server-snippets/agents.worker.ts"

log "1) Latest builder repo pull"
cd "$BUILDER_DIR"
git pull --ff-only || warn "git pull failed/dirty tree — continuing with current files"

log "2) DB migrations apply on AXONETIS self-hosted DB"
DB_URL="$(select_db_url || true)"
[ -n "$DB_URL" ] || die "DB URL auto-detect failed. Export AXONETIS_DB_URL with the real self-hosted Postgres URL, then rerun. Script will not print secrets."
validate_db_url "$DB_URL"
ok "DB URL detected (hidden)"
run_psql "$BUILDER_DIR/hetzner-migrations/20260711000001_phase_393_394_publish_power_tools.sql" file
run_psql "$BUILDER_DIR/hetzner-migrations/20260711000002_phase_396_397_marketplace_router.sql" file

log "3) DB verify"
run_psql "select count(*) as marketplace_agents from public.marketplace_agents;" command
run_psql "select column_name from information_schema.columns where table_schema='public' and table_name='agent_thread_messages' and column_name in ('cost_usd','saved_vs_default_usd','default_model','parent_message_id','loop_iteration','audit_status') order by column_name;" command

log "4) Wire /rpc routes in engine — NO duplicate router"
if [ ! -f "$RPC_FILE" ]; then
  cp "$BUILDER_DIR/server-snippets/rpc.routes.ts" "$RPC_FILE"
  ok "Installed rpc.routes.ts"
elif ! grep -q "publish.state" "$RPC_FILE" || ! grep -q "sql.validate" "$RPC_FILE"; then
  backup "$RPC_FILE"
  cp "$BUILDER_DIR/server-snippets/rpc.routes.ts" "$RPC_FILE"
  ok "Replaced incomplete rpc.routes.ts with complete 3.9.3/3.9.4 router (backup kept)"
else
  ok "Existing rpc.routes.ts already has 3.9.3/3.9.4 endpoints"
fi

cp "$BUILDER_DIR/server-snippets/rpc-phase-396-397.additions.ts" "$PHASE_396_FILE"
node --input-type=module - "$RPC_FILE" <<'NODE'
import fs from "node:fs";
const file = process.argv[2];
let src = fs.readFileSync(file, "utf8");
if (!src.includes('rpc-phase-396-397.additions')) {
  const importLine = 'import { registerRouterAndMarketplaceRoutes } from "./rpc-phase-396-397.additions";\n';
  const imports = [...src.matchAll(/^import .*$/gm)];
  if (imports.length) {
    const last = imports.at(-1);
    src = src.slice(0, last.index + last[0].length) + "\n" + importLine + src.slice(last.index + last[0].length);
  } else src = importLine + src;
}
if (!src.includes('registerRouterAndMarketplaceRoutes(router')) {
  const client = /\bsupabase3\s+as\s+supabase\b|\bconst\s+supabase\b|\bsupabase\s*=/.test(src) ? "supabase" : "supabase3";
  const call = `\n// Phase 3.9.6 + 3.9.7 — marketplace + global router (auto-wired, no duplicate router)\nregisterRouterAndMarketplaceRoutes(router, ${client});\n`;
  if (src.includes("export default router")) src = src.replace(/\nexport default router\s*;?/, `${call}\nexport default router;`);
  else src += call;
}
fs.writeFileSync(file, src);
NODE
ensure_supabase3_client "$ENGINE_DIR" "$ROUTE_DIR"
SERVER_ENTRY="$(find_server_entry "$ENGINE_DIR")"
wire_rpc_mount "$SERVER_ENTRY" "$RPC_FILE"

log "5) Visual Edit bridge inject into preview apps/templates"
for root in \
  "$BUILDER_DIR" "$ENGINE_DIR" \
  /var/www/hostflowai /var/www/anexvot-ai-pay /var/www/aiarapidpay /var/www/aiaxonet \
  /opt/hostflow-ecosystem/hostflow-server /opt/hostflowai-brain /root/hostflow-engine; do
  [ -d "$root" ] || continue
  mkdir -p "$root/public"
  cp "$BUILDER_DIR/server-snippets/preview-visual-edit-bridge.js" "$root/public/axonetis-preview-bridge.js"
  while IFS= read -r html; do
    [ -f "$html" ] || continue
    if ! grep -q "axonetis-preview-bridge.js" "$html"; then
      backup "$html"
      perl -0pi -e 's#</body>#  <script src="/axonetis-preview-bridge.js" defer></script>\n</body>#i' "$html" || true
    fi
  done < <(find "$root" -maxdepth 5 -type f \( -name "index.html" -o -name "*.html" \) 2>/dev/null | head -80)
done
grep -Rqs "anexvotaipay-preview" /var/www/anexvot-ai-pay/public "$BUILDER_DIR/server-snippets/preview-visual-edit-bridge.js" 2>/dev/null \
  && ok "Visual bridge source fixed: anexvotaipay-preview" \
  || die "Visual bridge missing anexvotaipay-preview source"

log "6) Stop button abort wiring verify"
AGENTS_ROUTE="$BUILDER_DIR/src/routes/api/agents.\$slug.chat.ts"
if [ -f "$AGENTS_ROUTE" ]; then
  grep -q "signal: request.signal" "$AGENTS_ROUTE" || die "Builder agents chat route missing request.signal wiring. Pull latest axonetis repo and rerun."
  ok "Builder TanStack chat route has request.signal wired"
fi
for worker_root in "$BUILDER_DIR" /root/axonetis-builder /opt/axonetis-builder /opt/AXONETIS-Builder; do
  [ -d "$worker_root" ] || continue
  if [ -d "$worker_root/src/workers" ]; then
    backup "$worker_root/src/workers/agents.worker.ts"
    cp "$BUILDER_DIR/server-snippets/agents.worker.ts" "$worker_root/src/workers/agents.worker.ts"
    ok "Installed Agent Loop worker at $worker_root/src/workers/agents.worker.ts"
  fi
done
STREAM_FILES="$(grep -Rsl 'streamText' "$ENGINE_DIR/src" "$ENGINE_DIR/server" "$ENGINE_DIR/routes" 2>/dev/null | grep -Ev 'node_modules|dist|build|\.bak-' || true)"
if [ -n "$STREAM_FILES" ]; then
  if printf '%s\n' "$STREAM_FILES" | xargs grep -qE 'abortSignal|request\.signal|req\.signal|AbortController'; then
    ok "Engine streamText abort wiring found"
  else
    warn "Engine streamText route found but abortSignal not detected. Smoke tests continue; Stop button backend must be patched in that engine file."
    printf '%s\n' "$STREAM_FILES"
  fi
else
  warn "No engine streamText route found; builder route already verified"
fi

log "7) Engine install/build/restart"
cd "$ENGINE_DIR"
git pull --ff-only || warn "Engine git pull failed/dirty tree — continuing with current files"
bun install
if [ -f package.json ] && node -e 'const p=require("./package.json"); process.exit(p.scripts&&p.scripts.build?0:1)' 2>/dev/null; then
  bun run build
fi
restart_pm2_if_exists hostflowai-brain
restart_pm2_if_exists hostflow-server
restart_pm2_if_exists aanris-runtime

log "8) Builder install/build/restart"
cd "$BUILDER_DIR"
bun install
bun run build
restart_pm2_if_exists axonetis-builder

log "9) Smoke tests — all pending server items"
BASE_URL="$DOMAIN"
if ! curl -fsS --max-time 8 "$BASE_URL/rpc/marketplace.list" >/tmp/axonetis-marketplace-smoke.json 2>/dev/null; then
  for base in "http://127.0.0.1:3000" "http://127.0.0.1:8080" "http://127.0.0.1:8787"; do
    if curl -fsS --max-time 8 "$base/rpc/marketplace.list" >/tmp/axonetis-marketplace-smoke.json 2>/dev/null; then BASE_URL="$base"; break; fi
  done
fi
log "Smoke BASE_URL=$BASE_URL"

set +e
echo "-- 3.9.6 marketplace.list"
MARKET_JSON="$(curl_json GET "$BASE_URL/rpc/marketplace.list")"; MARKET_STATUS=$?; echo "$MARKET_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s); console.log("agents=", Array.isArray(j.agents)?j.agents.length:"bad_json")}catch{console.log("bad_json")}})'

echo "-- 3.9.7 router.preview"
ROUTER_JSON="$(curl_json POST "$BASE_URL/rpc/router.preview" '{"prompt":"deploy karo","agent":"jimmy"}')"; ROUTER_STATUS=$?; echo "$ROUTER_JSON"

echo "-- 3.9.3 publish.state"
PUBLISH_JSON="$(curl_json GET "$BASE_URL/rpc/publish.state?projectId=founderbuilder")"; PUBLISH_STATUS=$?; echo "$PUBLISH_JSON"

echo "-- 3.9.3 deploys.status SSE headers"
curl -fsS --max-time 5 -N "$BASE_URL/rpc/deploys.status?projectId=founderbuilder" >/tmp/axonetis-deploys-sse.txt; DEPLOYS_STATUS=$?; head -5 /tmp/axonetis-deploys-sse.txt || true

echo "-- 3.9.4 sql.validate"
SQL_JSON="$(curl_json POST "$BASE_URL/rpc/sql.validate" '{"projectId":"founderbuilder","query":"select 1"}')"; SQL_STATUS=$?; echo "$SQL_JSON"

echo "-- 3.9.4 caddy.list"
CADDY_JSON="$(curl_json GET "$BASE_URL/rpc/caddy.list?projectId=founderbuilder")"; CADDY_STATUS=$?; echo "$CADDY_JSON"

echo "-- 3.9.4 timetravel.commits"
TIME_JSON="$(curl_json GET "$BASE_URL/rpc/timetravel.commits?projectId=founderbuilder&limit=1")"; TIME_STATUS=$?; echo "$TIME_JSON"

echo "-- 3.9.4 rrweb.list"
RRWEB_JSON="$(curl_json GET "$BASE_URL/rpc/rrweb.list?projectId=founderbuilder")"; RRWEB_STATUS=$?; echo "$RRWEB_JSON"
set -e

FAIL=0
for status in "$MARKET_STATUS" "$ROUTER_STATUS" "$PUBLISH_STATUS" "$DEPLOYS_STATUS" "$SQL_STATUS" "$CADDY_STATUS" "$TIME_STATUS" "$RRWEB_STATUS"; do
  [ "$status" -eq 0 ] || FAIL=1
done

if [ "$FAIL" -ne 0 ]; then
  warn "One or more smoke tests failed. PM2 logs below. No fake success."
  pm2 logs hostflowai-brain --lines 40 --nostream || true
  pm2 logs hostflow-server --lines 40 --nostream || true
  pm2 logs axonetis-builder --lines 40 --nostream || true
  exit 1
fi

log "✅ SERVER-SIDE LIVE: 3.9.3 → 3.9.7 wired, migrated, restarted, smoke-tested"
pm2 logs axonetis-builder --lines 20 --nostream || true