---
name: Hetzner Live Caddyfile LOCKED Aug 4 2026
description: Founder's actual /etc/caddy/Caddyfile on Hetzner box (NEXATECT rename applied). Already running. Lovable must NEVER suggest changes, replacements, or "improved" versions. Reference only — match port/route assumptions to this file.
type: feature
---

# Hetzner /etc/caddy/Caddyfile — LIVE (LOCKED, do not modify from Lovable)

Founder maintains this himself. Do NOT propose rewrites, "cleaner" versions, or duplicate snippets. If a frontend change needs a route, it must already match a block below. Otherwise ask founder before assuming.

Global block: `email admin@nexatect.com`, `on_demand_tls { ask http://localhost:8088/check-domain }` — do NOT change this contract.

## NEXATECT core
- `nexatect.com`, `www` → `localhost:4173`
- `anexvotpay.com`, `www` → static `/var/www/anexvotpay` (SPA try_files)

## Founder services (IP-gated: 39.40.0.0/13, 182.176.0.0/12, 119.160.0.0/13, 127.0.0.1, ::1)
- `foundercrm.nexatect.com` → `handle_path /hf/*` → `127.0.0.1:8080` (brain); founder_only: `/ssh*` → `:8092`, else `localhost:3000`; else 403 "Access Denied: Founder Only."
- `founderbuilder.axonetis.com` → identical shape: `/hf/*` → `127.0.0.1:8080`, `/ssh*` → `:8092`, else `localhost:3000`; else 403 "Access Denied: Sovereign Architecture Restricted."
- `foundercommandcenter.nexatect.com` → `:3005`
- `founderdashboard.nexatect.com` → `:3006`

## Platform (nexatect.com)
`app` → 3002 · `aicrm` → 3009 · `foundermail` → 8081 · `docs` → 3003 · `status` → 3004 · `admin` → 3007 · `settings` → 3008 · `preview` (on-demand TLS) → 3001 · `auth` → 54321 · `storage` → 8091 · `cdn` → static `/var/www/nexatect-cdn`
Industry subdomains → 3002: `tth, airline, carrental, healthcare, education, logistics, railways, ee`

## api.nexatect.com
founder_only IP gate → `localhost:8088` with `flush_interval -1`, read/write timeouts 10m (SSE-ready). Else 403 "Access Denied: Founder API Only."

## AXONETIS (temporary until Server 3)
- `axonetis.com`, `www` → `localhost:3000`
- `api.axonetis.com` → `localhost:8088` (public, SSE-ready, flush_interval -1, 10m timeouts)
- `sandbox.axonetis.com` → 3001 · `*.preview.axonetis.com` (on-demand TLS) → 3001
- `app` → 3002 · `docs` → 3003 · `status` → 3004 · `auth` → 54321 · `cdn` → static `/var/www/axonetis-cdn`

## Hard rules
1. Lovable NEVER edits this file, never installs/reloads caddy.
2. Brain (hostflowai-brain) is reachable publicly ONLY via `/hf/*` on founder hosts → `127.0.0.1:8080`. Frontend `VITE_HOSTFLOW_SERVER_URL` must therefore use the `/hf` prefix.
3. Rust runtime = `:8088` → `api.axonetis.com` / `api.nexatect.com` (SSE already flushed). No separate SSE host.
4. CORS / extra headers → founder adds; Lovable only documents the requirement.
5. Any new subdomain → founder edits this file himself; Lovable just wires the frontend URL.
