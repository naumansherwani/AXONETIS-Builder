---
name: NO CLOUDFLARE EVER LOCKED Jun 22 2026
description: Founder ka pura system pehle hijack ho chuka hai Cloudflare ke through. Cloudflare, Cloudflare DNS, Cloudflare proxy, Cloudflare Workers, Cloudflare R2/D1, Cloudflare tunnels — kabhi nahi. Wildcard SSL Caddy on-demand TLS (ask localhost:8088/check-domain) se hota hai, DNS challenge ki zarurat nahi.
type: constraint
---

# NO CLOUDFLARE — EVER (LOCKED)

Founder ka complete system pehle Cloudflare ke through hijacked ho chuka tha. Final decision:

## Forbidden — never suggest, never use
- Cloudflare DNS (orange-cloud proxy or grey-cloud DNS-only)
- Cloudflare API tokens / DNS-01 challenge for wildcard SSL
- Cloudflare Workers / Pages / R2 / D1 / KV
- Cloudflare Tunnels (cloudflared / Argo)
- Any "move DNS to Cloudflare for X" suggestion

## Final architecture (locked)
- **DNS**: Namecheap only (registrar-level A/CNAME/TXT records).
- **SSL**: Caddy auto Let's Encrypt HTTP-01.
- **Wildcard SSL** (`*.preview.axonetis.com`, future user previews): Caddy **on-demand TLS** — already live in `/etc/caddy/Caddyfile` global block:
  ```
  { on_demand_tls { ask http://localhost:8088/check-domain } }
  ```
  Rust runtime (`:8088`) ka `/check-domain` endpoint per-domain authorize karta hai → Caddy on-the-fly cert issue karta hai. Zero external DNS API. Zero Cloudflare.
- **CDN**: own `cdn.axonetis.com` (Caddy file_server on `/var/www/axonetis-cdn`).
- **Why**: sovereign, self-hosted, founder-controlled, no third-party hijack surface.

## Lovable rule
Agar wildcard SSL, DDoS protection, ya DNS proxy ki baat aaye — Cloudflare ka naam NA lo. Caddy on-demand TLS + Hetzner firewall + Rust rate-limiter answer hai.
