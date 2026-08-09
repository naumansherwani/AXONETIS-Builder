# ANEXOMAIL™ — AI server brief (doosray Lovable project ke liye)

> Naam LOCKED: **ANEXOMAIL™** (NOT "AXOMAIL"). Domain **anexomail.com**,
> founder workspace **founderworkspace.anexomail.com**. Purana naam kahin na likhein.

## 1. AI kahan chalta hai
- **Server 1 (Hetzner)** = NEXATECT/AXONETIS brain. ANEXOMAIL ka isse koi lena-dena nahi.
- **Server 2 (Hetzner, alag machine)** = **ANEXOMAIL AI**. Alag process, alag env,
  alag model registry. Dono ko kabhi mix nahi karna.
- Frontend (Lovable) sirf **frontend** hai. Koi AI key, koi model naam, koi provider
  frontend mein nahi. Har AI call server par.

## 2. Server par AI se related kya kya maujood hai
| Cheez | Kya karta hai | Use kab hota hai |
|---|---|---|
| Model registry (tiers) | FREE / PAID / FOUNDER model tiers + situation map | Har request par tier + situation se model chunta hai |
| Situation routing | EMAIL, REASONING, CODE, VISION, MULTILANG, FAST | Email drafting → email model, sochna → reasoning model |
| Key selection | founder key / paid key / free key | Founder = founder key, normal user = paid, free tier = free key |
| SSE stream endpoint | token-by-token reply | Chat/compose UI |
| Audit/verify pass | reply ko check karta hai bhejne se pehle | Auto-send / auto-reply flows |
| Memory store | thread + entity memory | Follow-up emails, context |
| Tool layer | file/db/fetch tools (server-side only) | Studio/agent tasks |

**Rule:** model naam kabhi hardcode nahi — registry/config source of truth hai.
Model badalna ho to server config badlo, frontend ko chhuo mat.

## 3. Use ke hisab se behaviour (yeh product boundary hai)
- **Workspace (email) user** → koi AI nahi. Saaf, private inbox. Bas.
- **ANEXOMAIL AI (LEO + studio)** → alag product surface, **abhi public nahi** —
  "Coming soon" page. Workspace ke andar AI features chhupa ke na daalein.
- **Founder** → founder tier: sabse strong models, sab tools, full logs.
- **Paid user** (jab launch ho) → paid tier models, limited tools, rate limit.
- **Free/trial** → free-tier models, no tools, sakht rate limit.

## 4. Hard rules
1. Naam **ANEXOMAIL™** only.
2. AI = separate product; workspace clean rahega.
3. AI keys/prompts/tools **server-only** — `VITE_*` mein kabhi nahi.
4. Server 1 ↔ Server 2 alag; endpoints copy-paste nahi karna.
5. Naya AI feature = pehle server par endpoint + tier check, phir frontend.
6. Koi duplicate service/table/route nahi — pehle search, phir extend.
