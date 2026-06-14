---
name: Founder full-file overwrite only — LOCKED
description: Never ask founder to edit/sed/patch any file. Always send the FULL file content (SQL, TS, JSON, bash, anything) as one complete copy-paste block that overwrites the file from scratch. Even for a 1-line/1-dot change.
type: preference
---

# RULE (LOCKED, NO EXCEPTIONS)

Founder edits karte waqt mistakes hoti hain. Isliye:

1. **NEVER** ask founder to `sed`, `grep -q | sed`, `awk`, manual line-add, "is line ke baad yeh add karo", or any in-place edit.
2. **ALWAYS** send the COMPLETE file content as a single copy-paste block — even if only 1 character changes.
3. Founder ka workflow: `cat > /full/path/file <<'EOF' ... EOF` (full overwrite) ya editor mein paste-replace-all.
4. Applies to: `.sql`, `.ts`, `.tsx`, `.js`, `.json`, `.env`, `nginx.conf`, `pm2 ecosystem`, bash scripts, EVERYTHING.
5. For multi-file changes: send each file in its own complete block with absolute path header.
6. If file is >500 lines, still send full — split into clearly marked parts only if chat truly cannot fit it.

**Why:** Founder ne explicitly locked. Edit instructions = bugs. Full overwrite = zero ambiguity.

**How to apply:** Before sending any server-side change, ask self: "Did I send the WHOLE file?" If no → rewrite the message.
