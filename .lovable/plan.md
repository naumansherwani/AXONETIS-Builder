
Bhai, pehle ek ek line padh li. Yeh request bahut bara hai (2 full tracks + rename) aur tumhare paas sirf ~35 credits hain. Agar main ek hi turn me sab build karun, 8-12 credits jaayenge aur quality compromise hogi. Isliye **strict phased plan** — har phase ke baad ruko, verify karo, "agla" bolo.

## Pre-flight (zero new files, no duplicates)

Existing audit jo main use karunga (already in tree, NO duplicate banega):
- `UnifiedChat.tsx` → Track B me sirf is file ko refactor karunga, naya chat component NAHI.
- `BuilderShell.tsx` + `HorizontalSplit.tsx` + `VerticalSplit.tsx` → Track A me right-pane ko dockable tab system me extend karunga, naya shell NAHI.
- `panels/*` (CodePanel, LogsPanel, DatabasePanel, etc.) already exist → tabs ke andar inhi ko mount karunga, naye panels NAHI.
- `projects.ts` me `Rapid Pay` → `ANEXVOT AI PAY` rename (1 line).

## Phase R (Rename — 1 credit, do abhi)
- `src/lib/projects.ts`: "Rapid Pay" → "ANEXVOT AI PAY", shortName "RP" → "AVP", url `idarapidpay.nexatect.com` → `anexvotaipay.nexatect.com`.
- Grep baaki references, fix labels only.

## Phase B (Chatbox Cockpit — Track B — 1 turn, ~3 credits)
Sirf `UnifiedChat.tsx` refactor. NO new component files.
- Replace Virtuoso with a native `div` `messagesRef` scroll container (overflow-y-auto, min-h-0, tabIndex={0}) — Virtuoso ka custom scroller arrow keys/Home/End/PageUp/Down properly support nahi karta consistently, aur tumne explicitly `scrollBy`/`scrollTo` mention kiya.
- Flex parents par `min-h-0` audit (BuilderShell column, UnifiedChat root, message area).
- Arrow rail: real `scrollBy({top: ±260})`, top/bottom pe disabled opacity, scroll position track via `onScroll`.
- Keyboard: ArrowUp/Down/PageUp/Down/Home/End on focused list; Ctrl/Cmd+Arrow on composer; Enter send, Shift+Enter newline, Esc blur.
- Auto-scroll only if user already at bottom (stickToBottom flag).
- Composer: pinned bottom, attach/mic sirf tab dikhao jab wired (already wired — keep), send→stop toggle (already done), focus return after send (already done).
- Hide any non-wired buttons. Remove the dead `<Slash/> tools` chip.
- Acceptance: 30 dummy messages dev-only verify, then remove.

## Phase A1 (Workspace Tabs Foundation — Track A part 1 — 1 turn, ~5 credits)
- Add deps in parallel: `xterm xterm-addon-fit xterm-addon-web-links xterm-addon-search react-resizable-panels @monaco-editor/react cmdk react-rnd`.
- New files (each is a NEW concept, no existing duplicate):
  - `src/components/builder/workspace/TabBar.tsx` — glass tab strip, active glow, close, reorder via drag.
  - `src/components/builder/workspace/WorkspaceTabs.tsx` — orchestrator with localStorage persist (`axonetis.workspace.tabs.v1`), keyboard Ctrl+1..9/W/T.
  - `src/components/builder/workspace/tab-registry.ts` — maps tab kind → existing panel component (Preview→LivePreview, Logs→LogsPanel, DB→DatabasePanel, GitHub→new, Terminal→new, Bridge→new).
- `BuilderShell.tsx`: right pane swap from single LivePreview → `<WorkspaceTabs/>`. Preview tab uses existing LivePreview untouched.
- Status-bar chips clickable → openTab(kind).
- No split/detach/popout yet (Phase A3).

## Phase A2 (Terminal + GitHub + Command Palette — 1 turn, ~5 credits)
- `workspace/TerminalTab.tsx` — xterm.js, fit, web-links, search addons; ANSI; Ctrl+C/L/K/F; status chip in tab title; "Not connected" empty state + Connect button (real WS hook to existing bridge endpoint, no fake stream).
- `workspace/GitHubTab.tsx` — sub-tabs Commits/Branches/PRs/Files/Diff; Monaco diff side-by-side; data via existing `hostflow-api` if wired, else "Connect GitHub" empty state.
- `workspace/CommandPalette.tsx` — cmdk, Ctrl+K, fuzzy: open tab / switch project / switch branch / run command / jump to file.

## Phase A3 (Split/Detach/Popout — 1 turn, ~4 credits)
- react-resizable-panels: right-click tab → Split right/down.
- react-rnd: drag tab out → floating window, re-dock on drop into strip.
- Popout: `/workspace/:kind/:sessionId` route mirrors via BroadcastChannel.

## Phase A4 (Polish — 1 turn, ~2 credits)
- Status bar latency/tokens/model chip/CPU spark.
- Scanline overlay on terminal only (3%).
- 180ms tab switch fade+slide.
- Empty terminal ASCII AXONETIS logo.

## Credit budget total: ~20 credits across 5 turns, 15 left as buffer

## Locked constraints (har phase me)
- Colors/tokens locked — zero palette change.
- No duplicate components — registry maps to existing panels.
- No fake buttons — hide if unwired.
- min-h-0 on every scroll parent.
- Only message list / terminal scroll, never cockpit panel.

## Pehla action
Phase R + Phase B saath me karunga (chhote hain, 1 turn me fit). Phir ruko bolo to A1 shuru. Confirm?
