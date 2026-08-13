---
name: No PM2 update in production commands LOCKED
description: Hetzner deploy/install commands must never run pm2 update; restore with pm2 resurrect and restart only the named process.
type: constraint
---

# LOCKED

- Never include `pm2 update` in any Hetzner production install, recovery, or deployment command.
- It can replace the daemon, stop all applications, and leave the process list empty.
- Restore the saved process list with `pm2 resurrect`.
- Deploy by restarting only the intended named process with `pm2 restart <name> --update-env`.
- Never create a duplicate process when the named process already exists.