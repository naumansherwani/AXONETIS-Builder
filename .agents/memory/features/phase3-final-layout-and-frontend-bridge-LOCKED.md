---
name: Phase 3 Final Layout + Frontend Bridge LOCKED
description: Founder locked final AXONETIS end result: Lovable-style chat/preview split, iframe domains, postMessage bridge UI, frontend-only calls existing HostFlow server APIs. No duplicate backend/bridge/Jimmy logic.
type: feature
---

# AXONETIS Phase 3 — FINAL END RESULT LOCKED

Founder confirmed this is the final Builder layout target:

- **Left side (~40%)** = Unified Build Chat for Founder/Jimmy/Sherlock prompts, queue, history.
- **Right side (~60%)** = Live Preview iframe.
- **Resizable divider** between chat and preview; drag-to-resize like Lovable.
- **Top bar** = AXONETIS logo + project/sandbox switcher + Preview/Code/Share/Publish actions.
- **Side drawer / rails** = Files, Code, Agents, Logs, Database, Deploy, Versions, Analytics panels.
- Project sandbox switcher loads exact domains in iframe:
  - HostFlow AI → `https://nexatect.com`
  - Rapid Pay → `https://rapidpay.nexatect.com`
  - AXONETIS → `https://aiaxonetis.nexatect.com`
- Preview communicates via **postMessage** both ways: route changes, clicks, runtime errors, bridge status return into Builder UI/chat/logs.

## Non-negotiable architecture locks

1. **Do NOT create a new AI backend.**
2. **Do NOT create a duplicate bridge layer.**
3. **Do NOT create Jimmy/Sherlock logic in frontend.**
4. Frontend only calls existing **HostFlow server APIs**.
5. HostFlow server remains the execution layer.
6. AXONETIS remains the Founder Workspace layer.
7. Lovable repo = frontend workspace only; server repo remains founder/manual.

## Phase 3 scope

Frontend-only bridge scaffolding is allowed:
- iframe postMessage listener/sender
- project switcher → iframe URL updates
- bridge status UI/logs
- typed client wrappers for HostFlow server API calls

Forbidden in Phase 3:
- no database migrations unless founder explicitly confirms server ready
- no backend/server function execution layer
- no AI model orchestration in frontend
- no duplicate bridge implementation
