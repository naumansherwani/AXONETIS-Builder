---
name: AI SDK v4 system prompt rule
description: Vercel AI SDK v4+ streamText/generateText mein system prompt kabhi messages array mein role: system nahi bhejna — hamesha system: parameter use karna hai. Yeh rule har AI SDK server call par apply hoti hai.
type: constraint
---

## Rule

Vercel AI SDK v4+ mein `messages` array mein `{ role: "system", content: "..." }` add karna `InvalidPromptError` dega:

```
Invalid prompt: System messages are not allowed in the prompt or messages fields. Use the instructions option instead.
```

**Wrong:**
```ts
streamText({
  messages: [
    { role: "system", content: SYSTEM },
    { role: "user", content: "..." }
  ]
});
```

**Right:**
```ts
streamText({
  system: SYSTEM,
  messages: [
    { role: "user", content: "..." }
  ]
});
```

## Why

AI SDK v4 standardized `system` as a top-level parameter. `messages` array sirf `user` aur `assistant` roles accept karta hai. Sherlock route (`sherlock.ts`) isi galti se crash kar raha tha.

## How to apply

- Har naye AI SDK route mein `normalizeMessages()` function user+assistant filter ke saath use karo.
- System prompt ko function banao jo `projectId` accept kare (e.g. `JIMMY_SYSTEM(projectId)`), aur `streamText` ke `system:` mein pass karo.
- Legacy code review karte waqt yeh check karo: `grep -n "role: \"system\"" src/routes/**/*.ts`
