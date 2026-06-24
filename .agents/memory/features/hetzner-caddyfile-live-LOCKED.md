---
name: Hetzner Live Caddyfile LOCKED Jun 22 2026
description: Founder's actual /etc/caddy/Caddyfile on Hetzner box. Already running. Lovable must NEVER suggest changes, replacements, or "improved" versions. Reference only — match port/route assumptions to this file.
type: feature
---

# Hetzner /etc/caddy/Caddyfile — LIVE (LOCKED, do not modify from Lovable)

Founder ran this himself. Do NOT propose rewrites, "cleaner" versions, or duplicate snippets. If a frontend change needs a route, it must already match a block below. Otherwise ask founder before assuming.

## Port map (truth)
- `localhost:4173` → axonetis.com / www.axonetis.com (public marketing)
- `localhost:3000` → founderbuilder.axonetis.com (private Builder, PK IP whitelist + localhost)
- `localhost:8088` → api.axonetis.com (Rust runtime, SSE-ready: `flush_interval -1`, read/write 10m)
- `localhost:3001` → sandbox.axonetis.com + `*.preview.axonetis.com` (on-demand TLS via `/check-domain`)
- `localhost:3002` → app.axonetis.com (future public Builder)
- `localhost:3003` → docs.axonetis.com
- `localhost:3004` → status.axonetis.com
- `localhost:3005` → blog · `:3006` changelog · `:3007` community · `:3008` affiliate
- `localhost:54321` → auth.axonetis.com (self-hosted Supabase)
- `localhost:8080` → api.nexatect.com
- `/var/www/hostflowai` → nexatect.com + all industry subdomains (ttl, airline, healthcare, carrental, education, ee, logistics, railways, aiaxomail)
- `/var/www/anexvot-ai-pay` → anexvotaipay.nexatect.com
- `/var/www/axonetis-cdn` → cdn.axonetis.com
- `aiaxonetis.nexatect.com` → 301 redir to `https://axonetis.com{uri}`

## On-demand TLS
Global block uses `ask http://localhost:8088/check-domain` — Rust runtime authorizes wildcard preview certs. Do NOT change this contract.

## Founder-only block
`founderbuilder.axonetis.com` allows: `39.40.0.0/13`, `182.176.0.0/12`, `119.160.0.0/13`, `127.0.0.1`, `::1`. All others → 403 "Access Denied: Sovereign Architecture Restricted."

## Hard rules
1. Lovable NEVER edits this file, never runs `apt install caddy`, never reloads caddy.
2. Frontend (`VITE_NEXATECT_API_URL`) must point to `https://api.axonetis.com` — matches `:8088`.
3. SSE endpoints land on `api.axonetis.com` (already `flush_interval -1`). No separate SSE host needed.
4. CORS / extra headers on `api.axonetis.com` — if needed, founder adds; Lovable only documents the requirement.
5. Any new subdomain founder wants → he edits this file himself; Lovable just wires the frontend URL.
