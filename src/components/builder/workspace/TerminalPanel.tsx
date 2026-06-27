/**
 * Phase A3.1 — REAL SSH/PTY Terminal
 * Connects to axonetis-ssh-bridge (Hetzner) via WebSocket → node-pty bash.
 * Same experience as `ssh root@88.198.208.90` in your local terminal.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Plug, PlugZap, Loader2 } from "lucide-react";
import "xterm/css/xterm.css";

const WS_URL =
  (typeof window !== "undefined" && window.location.hostname === "localhost")
    ? "ws://localhost:8092/ssh"
    : "wss://founderbuilder.axonetis.com/ssh";

type Status = "idle" | "connecting" | "open" | "closed" | "error";

export default function TerminalPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onDataDisposeRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [autoReconnect, setAutoReconnect] = useState(true);
  const backoffRef = useRef(1000);

  const writeLine = (s: string) => termRef.current?.writeln(s);

  const connect = useCallback(() => {
    if (!termRef.current) return;
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    setStatus("connecting");
    writeLine("\r\n\x1b[2mconnecting to " + WS_URL + " ...\x1b[0m");

    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e: any) {
      setStatus("error");
      writeLine("\x1b[31mWebSocket error: " + (e?.message ?? e) + "\x1b[0m");
      return;
    }
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
      backoffRef.current = 1000;
      try {
        const { cols, rows } = termRef.current;
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      } catch { /* noop */ }
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") termRef.current?.write(ev.data);
      else termRef.current?.write(new Uint8Array(ev.data));
    };
    ws.onerror = () => {
      setStatus("error");
    };
    ws.onclose = (ev) => {
      setStatus("closed");
      writeLine(`\r\n\x1b[2m[disconnected${ev.code ? " · code " + ev.code : ""}]\x1b[0m`);
      if (autoReconnect) {
        const delay = Math.min(backoffRef.current, 15000);
        backoffRef.current = Math.min(backoffRef.current * 1.7, 15000);
        writeLine(`\x1b[2mreconnect in ${Math.round(delay / 1000)}s ...\x1b[0m`);
        setTimeout(() => { if (autoReconnect) connect(); }, delay);
      }
    };

    onDataDisposeRef.current?.();
    const sub = termRef.current.onData((data: string) => {
      if (ws.readyState === 1) ws.send(data);
    });
    onDataDisposeRef.current = () => sub.dispose();
  }, [autoReconnect]);

  const disconnect = useCallback(() => {
    setAutoReconnect(false);
    try { wsRef.current?.close(); } catch { /* noop */ }
  }, []);

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
        },
        allowProposedApi: true,
        scrollback: 8000,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(hostRef.current);
      fit.fit();
      termRef.current = term;
      fitRef.current = fit;

      term.writeln("\x1b[38;5;203mAXONETIS\x1b[0m real SSH terminal · root@88.198.208.90");
      term.writeln("\x1b[2mClick Connect to open a PTY session via axonetis-ssh-bridge.\x1b[0m");
      term.writeln("");

      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
          const ws = wsRef.current;
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          }
        } catch { /* noop */ }
      });
      ro.observe(hostRef.current);

      cleanup = () => {
        onDataDisposeRef.current?.();
        try { wsRef.current?.close(); } catch { /* noop */ }
        ro.disconnect();
        term.dispose();
      };
    })();

    return () => { disposed = true; cleanup?.(); };
  }, []);

  const dot =
    status === "open" ? "bg-green-400 shadow-[0_0_8px_#22c55e]" :
    status === "connecting" ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]" :
    status === "error" ? "bg-[#E50914] shadow-[0_0_8px_#E50914]" :
    "bg-white/30";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#040406]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/60">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          Terminal · root@88.198.208.90
          <span className="ml-2 text-[10px] normal-case tracking-normal text-white/40">{status}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {status !== "open" ? (
            <button
              onClick={() => { setAutoReconnect(true); backoffRef.current = 1000; connect(); }}
              disabled={status === "connecting"}
              className="flex items-center gap-1.5 rounded-md border border-[#E50914]/40 bg-[#E50914]/10 px-2 py-1 text-[11px] text-white hover:bg-[#E50914]/20 disabled:opacity-50"
            >
              {status === "connecting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlugZap className="h-3 w-3" />}
              Connect
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.06]"
            >
              <Plug className="h-3 w-3" /> Disconnect
            </button>
          )}
        </div>
      </div>
      <div ref={hostRef} className="flex-1 min-h-0 overflow-hidden p-2" />
    </div>
  );
}
