/**
 * Phase A2 — Terminal tab (xterm.js).
 * Read-only system console + local echo prompt. No real PTY (no child_process
 * in worker runtime); founder runs the actual shell commands on Hetzner.
 * Lines streamed via a small command parser: `help`, `clear`, `status`, `pm2`.
 */
import { useEffect, useRef } from "react";
import "xterm/css/xterm.css";

const BANNER = [
  "\x1b[38;5;203mAXONETIS\x1b[0m Founder Terminal · read-only client console",
  "\x1b[2mType `help` for commands. Real shell runs on Hetzner.\x1b[0m",
  "",
];

const HELP = [
  "  \x1b[38;5;203mhelp\x1b[0m      Show this message",
  "  \x1b[38;5;203mclear\x1b[0m     Clear the screen",
  "  \x1b[38;5;203mstatus\x1b[0m    Show builder status",
  "  \x1b[38;5;203mpm2\x1b[0m       Print canonical PM2 layout",
  "  \x1b[38;5;203mpull\x1b[0m      Print server pull command",
];

const PM2 = [
  "┌────┬────────────────────┬────────────┐",
  "│ id │ name               │ status     │",
  "├────┼────────────────────┼────────────┤",
  "│ 0  │ aanris-runtime     │ online     │",
  "│ 8  │ axonetis-builder   │ online     │",
  "│ 7  │ axonetis-rust-hum… │ online     │",
  "│ 5  │ hostflow-server    │ online     │",
  "│ 2  │ hostflowai-brain   │ online     │",
  "└────┴────────────────────┴────────────┘",
];

const PULL = [
  "\x1b[2m# Run on Hetzner:\x1b[0m",
  "cd /opt/hostflow-ecosystem/rapid-dialogue-guide && \\",
  "  git checkout -- src/routeTree.gen.ts && git pull && \\",
  "  npm install && npm run build && \\",
  "  pm2 restart axonetis-builder --update-env",
];

export default function TerminalPanel() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("xterm"),
        import("xterm-addon-fit"),
        import("xterm-addon-web-links"),
      ]);
      if (disposed || !hostRef.current) return;

      const term = new Terminal({
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        lineHeight: 1.35,
        cursorBlink: true,
        theme: {
          background: "#040406",
          foreground: "#e6e6ea",
          cursor: "#E50914",
          selectionBackground: "#E5091433",
          black: "#0a0a10",
          brightBlack: "#3a3a44",
        },
        allowProposedApi: true,
        scrollback: 4000,
        convertEol: true,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(hostRef.current);
      fit.fit();

      const writeLines = (lines: string[]) => lines.forEach((l) => term.writeln(l));
      const prompt = () => term.write("\x1b[38;5;203m›\x1b[0m ");

      writeLines(BANNER);
      prompt();

      let buf = "";
      const onKey = term.onData((data: string) => {
        for (const ch of data) {
          const code = ch.charCodeAt(0);
          if (code === 13) {
            term.write("\r\n");
            const cmd = buf.trim().toLowerCase();
            buf = "";
            if (cmd === "help") writeLines(HELP);
            else if (cmd === "clear") term.clear();
            else if (cmd === "status") {
              term.writeln("\x1b[38;5;42m●\x1b[0m builder: online");
              term.writeln("\x1b[38;5;42m●\x1b[0m bridge:  ready");
              term.writeln("\x1b[38;5;42m●\x1b[0m hetzner: 88.198.208.90");
            } else if (cmd === "pm2") writeLines(PM2);
            else if (cmd === "pull") writeLines(PULL);
            else if (cmd.length > 0) term.writeln(`\x1b[2munknown:\x1b[0m ${cmd}  \x1b[2m(type 'help')\x1b[0m`);
            prompt();
          } else if (code === 127) {
            if (buf.length > 0) { buf = buf.slice(0, -1); term.write("\b \b"); }
          } else if (code >= 32) {
            buf += ch; term.write(ch);
          }
        }
      });

      const ro = new ResizeObserver(() => { try { fit.fit(); } catch { /* noop */ } });
      ro.observe(hostRef.current);

      cleanup = () => { onKey.dispose(); ro.disconnect(); term.dispose(); };
    })();

    return () => { disposed = true; cleanup?.(); };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#040406]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/60">
          <span className="h-2 w-2 rounded-full bg-[#E50914] shadow-[0_0_8px_#E50914]" />
          Terminal · founder console
        </div>
        <div className="text-[10px] text-white/40">xterm · client-side</div>
      </div>
      <div ref={hostRef} className="flex-1 min-h-0 overflow-hidden p-2" />
    </div>
  );
}
