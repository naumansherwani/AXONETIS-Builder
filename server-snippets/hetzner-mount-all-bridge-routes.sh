#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AXONETIS — MOUNT ALL BRIDGE ROUTES + VERIFY (idempotent, no duplicates)
#
# Deep-audit fix: frontend ke saare /rpc/* aur /api/* callers ke liye
# server-snippets ke routers ek hi baar mount karta hai, build karta hai,
# PM2 restart karta hai, aur har endpoint ka real HTTP status matrix deta hai.
#
# Run (Hetzner):
#   cd /var/www/axonetis && git pull
#   BRIDGE_DIR=/opt/hostflow-ecosystem/hostflow-server \
#     bash server-snippets/hetzner-mount-all-bridge-routes.sh
#
# BRIDGE_DIR optional — script khud dhoondh leta hai.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

BUILDER_DIR="${BUILDER_DIR:-/var/www/axonetis}"
SNIP="$BUILDER_DIR/server-snippets"
# Source of truth = local bridge. Public /hf sirf Caddy reverse-proxy layer hai;
# uska 404 mount ka masla nahi, routing ka masla hai (section 7 diagnose karta hai).
VERIFY_BASE="${VERIFY_BASE:-http://127.0.0.1:8090}"
PUBLIC_BASE="${PUBLIC_BASE:-https://founderbuilder.axonetis.com/hf}"

log()  { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32mOK\033[0m   %s\n' "$*"; }
bad()  { printf '  \033[1;31mFAIL\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33mWARN\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mSTOP: %s\033[0m\n' "$*"; exit 1; }

# ── 1. bridge dir dhoondo ────────────────────────────────────────────────────
log "1) Bridge (hostflow-server) directory"
if [ -z "${BRIDGE_DIR:-}" ]; then
  for c in /opt/hostflow-ecosystem/hostflow-server /opt/hostflow-server \
           /var/www/hostflow-server /root/hostflow-server; do
    [ -f "$c/package.json" ] && BRIDGE_DIR="$c" && break
  done
fi
[ -n "${BRIDGE_DIR:-}" ] && [ -f "$BRIDGE_DIR/package.json" ] \
  || die "BRIDGE_DIR nahi mila. Manually do: BRIDGE_DIR=/path bash $0"
ENTRY=""
for e in "$BRIDGE_DIR/src/index.ts" "$BRIDGE_DIR/src/server.ts" "$BRIDGE_DIR/src/app.ts"; do
  [ -f "$e" ] && ENTRY="$e" && break
done
[ -n "$ENTRY" ] || die "Express entrypoint (src/index.ts) nahi mila in $BRIDGE_DIR"
ok "BRIDGE_DIR=$BRIDGE_DIR"
ok "ENTRY=$ENTRY"
mkdir -p "$BRIDGE_DIR/src/routes"

# ── 2. routers copy (sirf badle hue) ────────────────────────────────────────
log "2) Router files copy → src/routes/"
ROUTERS=(
  founder-panel.routes.ts axon-io.routes.ts agents.cancel.ts
  ops.routes.ts rpc.routes.ts deploy.routes.ts explain.routes.ts diff.routes.ts preview.routes.ts
  plan.routes.ts verify.routes.ts delegate.routes.ts orchestrate.routes.ts
  lsp.routes.ts tests.routes.ts vision.routes.ts browser.routes.ts
  fullstack.routes.ts migration.routes.ts replay.routes.ts
  versions.routes.ts dual-brain.routes.ts
)
COPIED=()
for f in "${ROUTERS[@]}"; do
  if [ -f "$SNIP/$f" ]; then
    if ! cmp -s "$SNIP/$f" "$BRIDGE_DIR/src/routes/$f"; then
      cp "$SNIP/$f" "$BRIDGE_DIR/src/routes/$f"; ok "copied $f"
    else
      ok "unchanged $f"
    fi
    COPIED+=("$f")
  else
    warn "snippet missing: $f (skip)"
  fi
done
[ ${#COPIED[@]} -gt 0 ] || die "koi router copy nahi hua"

# ── 3. deps ─────────────────────────────────────────────────────────────────
log "3) Dependencies (multer, pg, @supabase/supabase-js)"
cd "$BRIDGE_DIR" || die "cd $BRIDGE_DIR fail"
PKG_MGR="npm"; command -v bun >/dev/null && [ -f bun.lockb -o -f bun.lock ] && PKG_MGR="bun"
for dep in multer pg @supabase/supabase-js; do
  if node -e "require.resolve('$dep')" 2>/dev/null; then
    ok "$dep present"
  else
    if [ "$PKG_MGR" = bun ]; then bun add "$dep" >/dev/null 2>&1; else npm i "$dep" >/dev/null 2>&1; fi
    node -e "require.resolve('$dep')" 2>/dev/null && ok "$dep installed" || warn "$dep install fail"
  fi
done
node -e "require.resolve('@types/multer')" 2>/dev/null || {
  if [ "$PKG_MGR" = bun ]; then bun add -d @types/multer >/dev/null 2>&1; else npm i -D @types/multer >/dev/null 2>&1; fi
}

# ── 4. idempotent mount (NO duplicate) ──────────────────────────────────────
log "4) Mount in $ENTRY — idempotent, duplicate guard"
# jimmy.routes.ts Brain-only route hai. Purane mega-mount versions ne isay
# Bridge mein import/mount kar diya tha; startup se pehle woh stale wiring hatao.
python3 - "$ENTRY" <<'PY'
import re, sys

entry = sys.argv[1]
src = open(entry, encoding="utf-8").read()
orig = src

src = re.sub(
    r'^import\s+\w+\s+from\s+["\']\.\/routes\/jimmy\.routes(?:\.js)?["\'];\s*\n?',
    '',
    src,
    flags=re.M,
)
src = re.sub(r'^\s*app\.use\(\s*jimmyRouter\s*\);\s*\n?', '', src, flags=re.M)

if src != orig:
    open(entry, "w", encoding="utf-8").write(src)
    print("  removed stale Brain-only jimmy route from Bridge")
else:
    print("  no stale Jimmy bridge wiring found")
PY

python3 - "$ENTRY" "${COPIED[@]}" <<'PY'
import re, sys
entry, *files = sys.argv[1:]
src = open(entry, encoding="utf-8").read()
orig = src

def varname(f):
    base = f.replace(".routes.ts","").replace(".ts","")
    parts = re.split(r"[^A-Za-z0-9]+", base)
    return parts[0] + "".join(p.capitalize() for p in parts[1:]) + "Router"

mounts, imports = [], []
for f in files:
    if f == "agents.cancel.ts":      # helper, not a router
        continue
    v = varname(f)
    imp = f'import {v} from "./routes/{f[:-3]}.js";'
    if v not in src:
        imports.append(imp)
    if f"app.use({v})" not in src:
        mounts.append(f"app.use({v});")

if imports:
    # last top-level import ke baad daalo
    last = 0
    for m in re.finditer(r'^import .*?;$', src, re.M):
        last = m.end()
    src = src[:last] + "\n" + "\n".join(imports) + src[last:]

if mounts:
    marker = "// AXONETIS_BRIDGE_MOUNTS"
    block = marker + "\n" + "\n".join(mounts)
    # app.listen se pehle mount karo
    m = re.search(r'^\s*app\.listen\(', src, re.M)
    if m:
        src = src[:m.start()] + "\n" + block + "\n" + src[m.start():]
    else:
        src = src + "\n" + block + "\n"

if src != orig:
    open(entry, "w", encoding="utf-8").write(src)
    print(f"  patched: +{len(imports)} imports, +{len(mounts)} mounts")
else:
    print("  already mounted — no change (no duplicate)")
PY
# ── 4b. de-duplicate (idempotent heal) ──────────────────────────────────────
log "4b) De-duplicate imports / mounts / markers"
python3 - "$ENTRY" <<'PY'
import re, sys
entry = sys.argv[1]
lines = open(entry, encoding="utf-8").read().split("\n")
seen_imports, seen_mounts, seen_marker = set(), set(), False
out = []
for ln in lines:
    s = ln.strip()
    m_imp = re.match(r'^import\s+(\w+Router)\s+from\s+["\']\./routes/[^"\']+["\'];$', s)
    m_use = re.match(r'^app\.use\((?:"[^"]*",\s*)?(\w+Router)\);$', s)
    if s == "// AXONETIS_BRIDGE_MOUNTS":
        if seen_marker:
            continue
        seen_marker = True
    elif m_imp:
        if m_imp.group(1) in seen_imports:
            continue
        seen_imports.add(m_imp.group(1))
    elif m_use:
        key = (s,)
        if key in seen_mounts:
            continue
        seen_mounts.add(key)
    out.append(ln)
new = "\n".join(out)
if new != "\n".join(lines):
    open(entry, "w", encoding="utf-8").write(new)
    print("  removed duplicate imports/mounts/markers")
else:
    print("  no duplicates found")
PY
DUP=$(grep -c "AXONETIS_BRIDGE_MOUNTS" "$ENTRY" || true)
[ "$DUP" -le 1 ] && ok "mount marker count=$DUP" || die "duplicate mount marker ($DUP) — $ENTRY manually dekho"

# ── 5. build + restart ──────────────────────────────────────────────────────
log "5) Build + PM2 restart"
if grep -q '"build"' package.json; then
  BUILD_LOG=$(mktemp)
  if [ "$PKG_MGR" = bun ]; then bun run build >"$BUILD_LOG" 2>&1; else npm run build >"$BUILD_LOG" 2>&1; fi
  BUILD_RC=$?
  tail -20 "$BUILD_LOG"
  [ "$BUILD_RC" -eq 0 ] || die "build FAIL — restart skip kiya (purana code chalta rahega). Upar ke TS errors fix karo."
  ok "build clean"
else
  warn "no build script — assuming ts runtime"
fi

# `tsx watch` parent se alag child listener chhor sakta hai. PM2 ko pehle stop
# karke port ke HAR listener ko terminate karo; warna naya mounted source
# EADDRINUSE par crash hota hai aur purana child 404 serve karta rehta hai.
pm2 stop hostflow-server >/dev/null 2>&1 || die "pm2 stop hostflow-server fail"
for i in $(seq 1 10); do
  PORT_PIDS=$(ss -ltnpH 2>/dev/null | awk '$4 ~ /:8090$/ {print}' \
    | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u | tr '\n' ' ')
  [ -z "$PORT_PIDS" ] && break
  for p in $PORT_PIDS; do
    kill -9 "$p" 2>/dev/null && warn "stale listener pid=$p on :8090 killed"
  done
  sleep 1
done
if ss -ltnH 2>/dev/null | awk '$4 ~ /:8090$/ {found=1} END {exit !found}'; then
  die "port 8090 abhi bhi occupied hai — restart skip"
fi

# --update-env intentionally nahi: npm script ko unknown CLI flag leak ho raha tha.
pm2 restart hostflow-server >/dev/null 2>&1 || die "pm2 restart hostflow-server fail"
READY=0
for i in $(seq 1 30); do
  if curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:8090/health"; then
    READY=1
    ok "bridge :8090 up"
    break
  fi
  sleep 1
done
[ "$READY" -eq 1 ] || { pm2 logs hostflow-server --lines 30 --nostream || true; die "bridge :8090 start nahi hua"; }

# Public Caddy path test se pehle local mounted route prove karo. Is se stale
# public response aur source/mount failure ek doosre mein mix nahi honge.
LOCAL_HEALTH=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
  "http://127.0.0.1:8090/api/system/health")
[ "$LOCAL_HEALTH" = "200" ] || {
  pm2 logs hostflow-server --lines 30 --nostream || true
  die "local mounted route /api/system/health=$LOCAL_HEALTH (expected 200)"
}
ok "local mounted routes active"

# ── 6. endpoint matrix (real status codes) ──────────────────────────────────
log "6) Endpoint verify matrix — $PUBLIC_BASE"
PASS=0; FAILN=0
chk() { # chk METHOD PATH
  local m="$1" p="$2" code
  if [ "$m" = GET ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$PUBLIC_BASE$p")
  else
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 -X POST \
      -H 'content-type: application/json' -d '{}' "$PUBLIC_BASE$p")
  fi
  # 400/501 = route zinda hai (validation), 404 = mount missing
  case "$code" in
    200|201|202|204|400|401|422|501) ok  "$code $m $p"; PASS=$((PASS+1));;
    *)                               bad "$code $m $p"; FAILN=$((FAILN+1));;
  esac
}
chk GET  "/api/system/health"
chk GET  "/rpc/sandbox.status?projectId=hostflowai"
chk GET  "/api/agents/founder/costs?window=24h"
chk GET  "/api/agents/founder/secrets"
chk GET  "/api/agents/founder/security"
chk GET  "/api/agents/founder/storage/buckets"
chk GET  "/api/agents/founder/tools"
chk POST "/api/agents/founder/db/query"
chk GET  "/api/axon/bridge/health?projectId=hostflowai"
chk POST "/api/axon/commands"
chk POST "/api/agents/stream/test/cancel"
chk POST "/rpc/tools.abort"
chk GET  "/rpc/telemetry.snapshot?projectId=hostflowai"
chk GET  "/rpc/explain.get?projectId=hostflowai&messageId=x"
chk POST "/rpc/publish.run"

log "RESULT"
printf '  PASS=%s  FAIL=%s\n' "$PASS" "$FAILN"
if [ "$FAILN" -gt 0 ]; then
  warn "Neeche PM2 logs — jo 404 hai us ka router mount nahi hua ya path galat hai."
  pm2 logs hostflow-server --lines 30 --nostream || true
  exit 1
fi
printf '\n\033[1;32mALL BRIDGE ROUTES GREEN ✅\033[0m\n'
