/**
 * Database panel — LIVE row counts from Supabase 3 (head-count via anon key + RLS).
 * Tables without a SELECT policy for the current role show as "rls" (locked).
 */
import { useEffect, useState } from "react";
import { PanelSection, Row } from "./PanelChrome";
import { Database as DbIcon, Table2, Loader2 } from "lucide-react";
import { fetchTableCounts, type TableCount } from "@/lib/database-api";

export default function DatabasePanel() {
  const [core, setCore] = useState<TableCount[]>([]);
  const [mirror, setMirror] = useState<TableCount[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTableCounts()
      .then(({ core, mirror, live }) => {
        if (!alive) return;
        setCore(core); setMirror(mirror); setLive(live);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const rightFor = (t: TableCount) =>
    t.rows == null ? "rls" : `${t.rows} rows`;

  return (
    <div>
      <PanelSection title="Connection">
        <Row
          left={
            <>
              <DbIcon className="h-3.5 w-3.5 text-[#ff7480]" />
              <span>Hetzner · Supabase 3</span>
            </>
          }
          right={
            <span className="flex items-center gap-1.5">
              {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70" />}
              {live ? "live" : "offline"}
            </span>
          }
        />
      </PanelSection>

      <PanelSection title="Core Tables" action={<span className="text-[10px] text-muted-foreground/60">{core.length}</span>}>
        <div className="flex flex-col">
          {core.map((t) => (
            <Row
              key={t.name}
              left={<><Table2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-mono">{t.name}</span></>}
              right={rightFor(t)}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Cross-Product Mirrors" action={<span className="text-[10px] text-muted-foreground/60">{mirror.length}</span>}>
        <div className="flex flex-col">
          {mirror.map((t) => (
            <Row
              key={t.name}
              left={<><Table2 className="h-3.5 w-3.5 text-[#a855f7]" /><span className="font-mono">{t.name}</span></>}
              right={rightFor(t)}
            />
          ))}
        </div>
      </PanelSection>
    </div>
  );
}
