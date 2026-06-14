import { useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { Monitor, RefreshCw, Smartphone, Tablet, Columns3, FlaskConical, Rocket } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { PROJECTS } from "@/lib/projects";
import { createBridgeHandshake, getProjectOrigin, normalizePreviewBridgeEvent } from "@/lib/preview-bridge";
import { subscribePreviewChanges } from "@/lib/preview-engine";

type Device = "mobile" | "tablet" | "desktop";
const DEVICE_WIDTH: Record<Device, number> = { mobile: 375, tablet: 768, desktop: 1440 };

export default function LivePreview() {
  const { project, previewMode, setPreviewMode, bridgeStatus, setBridgeStatus, setLastBridgeEvent, previewEnv, setPreviewEnv, setLastPreviewChange } = useBuilder();
  const active = PROJECTS.find((p) => p.id === project)!;
  const [device, setDevice] = useState<Device>("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeStatusRef = useRef(bridgeStatus);

  useEffect(() => {
    bridgeStatusRef.current = bridgeStatus;
  }, [bridgeStatus]);

  useEffect(() => {
    setBridgeStatus("handshaking");
    setLastBridgeEvent(null);
    const timeout = window.setTimeout(() => {
      if (bridgeStatusRef.current !== "connected") setBridgeStatus("no-signal");
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [project, reloadKey, setBridgeStatus, setLastBridgeEvent]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const bridgeEvent = normalizePreviewBridgeEvent(event);
      if (!bridgeEvent) return;
      setLastBridgeEvent(bridgeEvent);
      setBridgeStatus("connected");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setBridgeStatus, setLastBridgeEvent]);

  // Phase 5: Realtime HMR — sandbox file changes auto-reload the iframe.
  useEffect(() => {
    if (previewEnv !== "sandbox") return;
    const unsubscribe = subscribePreviewChanges(project, "sandbox", (change) => {
      setLastPreviewChange(change);
      setReloadKey((k) => k + 1);
    });
    return unsubscribe;
  }, [project, previewEnv, setLastPreviewChange]);

  const sendHandshake = () => {
    frameRef.current?.contentWindow?.postMessage(createBridgeHandshake(project), getProjectOrigin(project));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Preview toolbar */}
      <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/40 px-3 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914]/40 to-transparent" />
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 fb-blink" />
          <span className="font-mono text-[11px] text-muted-foreground">{active.previewUrl}</span>
          <div className="ml-2 flex rounded-md border border-white/[0.08] bg-white/[0.02] p-0.5">
            <button
              onClick={() => setPreviewEnv("sandbox")}
              className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-medium uppercase tracking-widest transition-colors ${
                previewEnv === "sandbox" ? "bg-amber-400/15 text-amber-300" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Sandbox — AI changes land here first"
            >
              <FlaskConical className="h-3 w-3" /> Sandbox
            </button>
            <button
              onClick={() => setPreviewEnv("production")}
              className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-medium uppercase tracking-widest transition-colors ${
                previewEnv === "production" ? "bg-emerald-400/15 text-emerald-300" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Production — read-only preview of live site"
            >
              <Rocket className="h-3 w-3" /> Prod
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <BridgeChip status={bridgeStatus} />
          {previewMode === "single" && (
            <div className="mr-2 flex rounded-md border border-white/[0.08] bg-white/[0.02] p-0.5">
              <DeviceBtn icon={Smartphone} active={device === "mobile"} onClick={() => setDevice("mobile")} />
              <DeviceBtn icon={Tablet} active={device === "tablet"} onClick={() => setDevice("tablet")} />
              <DeviceBtn icon={Monitor} active={device === "desktop"} onClick={() => setDevice("desktop")} />
            </div>
          )}

          <button
            onClick={() => setPreviewMode(previewMode === "single" ? "triptych" : "single")}
            className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors ${
              previewMode === "triptych"
                ? "border-[#E50914]/40 bg-[#E50914]/10 text-[#ff6b73]"
                : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-foreground"
            }`}
            title="Triptych: Mobile + Tablet + Desktop side-by-side"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Triptych
          </button>

          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview surface */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_50%_-20%,rgba(229,9,20,0.06),transparent_60%)] p-4">
        {previewMode === "single" ? (
          <SingleFrame refEl={frameRef} url={active.previewUrl} device={device} reloadKey={reloadKey} onLoad={sendHandshake} />
        ) : (
          <TriptychFrames url={active.previewUrl} reloadKey={reloadKey} onLoad={sendHandshake} />
        )}
      </div>
    </div>
  );
}

function BridgeChip({ status }: { status: string }) {
  const cls = status === "connected"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : status === "no-signal"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
      : "border-white/[0.08] bg-white/[0.02] text-muted-foreground";
  return (
    <span className={`mr-2 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${cls}`}>
      Bridge · {status}
    </span>
  );
}

function DeviceBtn({ icon: Icon, active, onClick }: { icon: typeof Monitor; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`grid h-6 w-6 place-items-center rounded transition-colors ${
        active ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

function SingleFrame({
  refEl,
  url,
  device,
  reloadKey,
  onLoad,
}: { refEl: RefObject<HTMLIFrameElement | null>; url: string; device: Device; reloadKey: number; onLoad: () => void }) {
  const width = DEVICE_WIDTH[device];
  return (
    <motion.div
      key={device}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="fb-glass overflow-hidden rounded-xl shadow-[0_30px_120px_-20px_rgba(229,9,20,0.25)]"
      style={{ width: device === "desktop" ? "100%" : width, maxWidth: "100%", height: "100%" }}
    >
      <iframe
        ref={refEl}
        key={reloadKey}
        src={url}
        title="Live preview"
        onLoad={onLoad}
        className="h-full w-full bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </motion.div>
  );
}

function TriptychFrames({ url, reloadKey, onLoad }: { url: string; reloadKey: number; onLoad: () => void }) {
  const frames: { device: Device; label: string }[] = [
    { device: "mobile", label: "Mobile · 375" },
    { device: "tablet", label: "Tablet · 768" },
    { device: "desktop", label: "Desktop · 1440" },
  ];
  return (
    <div className="flex h-full w-full items-stretch justify-center gap-4">
      {frames.map((f, i) => (
        <motion.div
          key={f.device}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 15, delay: i * 0.04 }}
          className="flex flex-col items-center gap-2"
          style={{ flex: f.device === "desktop" ? 2 : 1, minWidth: 0 }}
        >
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{f.label}</div>
          <div className="fb-glass w-full flex-1 overflow-hidden rounded-lg">
            <iframe
              key={`${f.device}-${reloadKey}`}
              src={url}
              title={`Preview ${f.device}`}
              onLoad={onLoad}
              className="h-full w-full bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
