/**
 * ⚠️ YEH HOSTFLOW-SERVER (BRIDGE) REPO KI FILE HAI — wait NO,
 *    yeh ek NAYA standalone PM2 process hai:
 *    /opt/hostflow-ecosystem/axonetis-ssh-bridge/index.ts
 *
 * axonetis-ssh-bridge — Node + ws + node-pty.
 * Browser xterm ↔ this WS ↔ node-pty bash (running as root via PM2).
 * No SSH hop needed: bridge already runs ON Hetzner as root.
 *
 * Run: pm2 start ecosystem.config.cjs
 * Port: 8092 (Caddy proxies /ssh → :8092)
 */
import * as http from "node:http";
import { WebSocketServer } from "ws";
import * as pty from "node-pty";

const PORT = Number(process.env.SSH_BRIDGE_PORT ?? 8092);
const SHELL = process.env.SSH_BRIDGE_SHELL ?? "/bin/bash";
const ALLOWED_ORIGINS = (process.env.SSH_BRIDGE_ORIGINS ??
  "https://founderbuilder.axonetis.com")
  .split(",").map(s => s.trim()).filter(Boolean);

const server = http.createServer((req, res) => {
  if (req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server, path: "/ssh" });

wss.on("connection", (ws, req) => {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
    ws.close(4403, "origin not allowed");
    return;
  }

  const term = pty.spawn(SHELL, ["-l"], {
    name: "xterm-256color",
    cols: 100,
    rows: 30,
    cwd: process.env.HOME ?? "/root",
    env: { ...process.env, TERM: "xterm-256color" },
  });

  console.log(`[ssh-bridge] session ${term.pid} from ${origin}`);

  term.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });
  term.onExit(({ exitCode }) => {
    try { ws.close(1000, `pty exit ${exitCode}`); } catch { /* noop */ }
  });

  ws.on("message", (raw) => {
    const str = raw.toString();
    // Try parse JSON control frame {type:"resize",cols,rows}
    if (str.startsWith("{")) {
      try {
        const msg = JSON.parse(str);
        if (msg.type === "resize" && msg.cols && msg.rows) {
          term.resize(Number(msg.cols), Number(msg.rows));
          return;
        }
      } catch { /* fall through to write */ }
    }
    term.write(str);
  });

  ws.on("close", () => {
    try { term.kill(); } catch { /* noop */ }
    console.log(`[ssh-bridge] session ${term.pid} closed`);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[ssh-bridge] listening 127.0.0.1:${PORT} (allowed origins: ${ALLOWED_ORIGINS.join(", ")})`);
});
