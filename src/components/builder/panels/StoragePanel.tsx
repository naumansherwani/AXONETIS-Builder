/**
 * Storage panel — buckets + object counts from Hetzner brain.
 * Click a bucket to reveal first 50 objects (name + size).
 */
import { useEffect, useState } from "react";
import { Folder, FolderOpen, File as FileIcon, Loader2, Lock, Globe } from "lucide-react";
import { PanelSection, Row } from "./PanelChrome";
import {
  fetchBuckets,
  fetchObjects,
  type StorageBucket,
  type StorageObject,
} from "@/lib/storage-api";

function humanBytes(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(n) / 3));
  return `${(n / 10 ** (i * 3)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export default function StoragePanel() {
  const [buckets, setBuckets] = useState<StorageBucket[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [objLoading, setObjLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchBuckets()
      .then((s) => {
        if (!alive) return;
        setBuckets(s.buckets);
        setLive(s.live);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!openBucket) {
      setObjects([]);
      return;
    }
    let alive = true;
    setObjLoading(true);
    fetchObjects(openBucket)
      .then((o) => {
        if (alive) setObjects(o);
      })
      .finally(() => {
        if (alive) setObjLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [openBucket]);

  return (
    <div>
      <PanelSection
        title="Buckets"
        action={
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {buckets.length} · {live ? "live" : "offline"}
          </span>
        }
      >
        {!buckets.length && !loading ? (
          <div className="px-2 py-3 text-[11px] text-muted-foreground/60">
            {live ? "No buckets yet." : "Server offline — waiting for brain."}
          </div>
        ) : (
          <div className="flex flex-col">
            {buckets.map((b) => (
              <Row
                key={b.name}
                active={openBucket === b.name}
                onClick={() => setOpenBucket(openBucket === b.name ? null : b.name)}
                left={
                  <>
                    {openBucket === b.name ? (
                      <FolderOpen className="h-3.5 w-3.5 text-[#ff7480]" />
                    ) : (
                      <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="font-mono">{b.name}</span>
                    {b.public ? (
                      <Globe className="h-3 w-3 text-emerald-400/80" />
                    ) : (
                      <Lock className="h-3 w-3 text-muted-foreground/60" />
                    )}
                  </>
                }
                right={
                  <span className="flex items-center gap-2 font-mono">
                    <span>{b.objectCount}</span>
                    <span className="text-muted-foreground/60">{humanBytes(b.totalBytes)}</span>
                  </span>
                }
              />
            ))}
          </div>
        )}
      </PanelSection>

      {openBucket && (
        <PanelSection
          title={`Objects · ${openBucket}`}
          action={
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              {objLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              {objects.length}
            </span>
          }
        >
          {!objects.length && !objLoading ? (
            <div className="px-2 py-3 text-[11px] text-muted-foreground/60">Empty bucket.</div>
          ) : (
            <div className="flex flex-col">
              {objects.map((o) => (
                <Row
                  key={o.key}
                  left={
                    <>
                      <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate font-mono text-[11px]">{o.key}</span>
                    </>
                  }
                  right={<span className="font-mono">{humanBytes(o.size)}</span>}
                />
              ))}
            </div>
          )}
        </PanelSection>
      )}
    </div>
  );
}
