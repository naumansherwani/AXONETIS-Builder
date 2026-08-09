---
name: Jimmy/Sherlock founder-voice enforcement LOCKED
description: Builder proxy (src/routes/api/agents.$slug.chat.ts) must structurally detect and rewrite any greeting/self-intro/status-recap/offer-to-help/English-only agent reply before it reaches the founder.
type: constraint
---
Jimmy aur Sherlock ke replies founder ke apne style mein hone chahiye (natural Roman Urdu/Hindi, seedha point, no greeting, no intro, no "what's the priority" filler, no ™ status recap, no English-only paragraph).

Enforcement Builder proxy mein hai (Brain repo NEVER touch):
- `violatesFounderVoice()` — structural checks: greeting first line, self-intro, offer filler, status recap, 2+ ™ in short reply.
- `mismatchedLanguage()` — founder Roman Urdu likhe aur reply pure English ho to violation.
- `stripFounderVoiceFiller()` — edges se filler lines hata do.
- `enforceFounderVoice()` — final gate before every DB insert/stream finish; strip, warna Groq/OpenRouter se rewrite pass.

Rule: kabhi keyword-list par bharosa nahi karna — naye greeting patterns structural detection se pakde jaate hain. Har naya agent reply path (stream + non-stream) ko `enforceFounderVoice()` se guzarna zaroori hai.
