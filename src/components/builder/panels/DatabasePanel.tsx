/**
 * Database panel — Supabase 3 schema browser.
 * Phase 2 visual: mirrors the Phase 1 SQL tables actually deployed on Hetzner.
 */
import { PanelSection, Row } from "./PanelChrome";
import { Database as DbIcon, Table2 } from "lucide-react";

const CORE = [
  { name: "projects", rows: 3 },
  { name: "project_files", rows: 0 },
  { name: "ai_agent_identities", rows: 11 },
  { name: "ai_model_registry", rows: 0 },
  { name: "user_roles", rows: 1 },
  { name: "ai_threads", rows: 0 },
  { name: "ai_messages", rows: 0 },
  { name: "deployments", rows: 0 },
];

const MIRROR = [
  { name: "mirror_hostflow_tenants" },
  { name: "mirror_hostflow_jobs" },
  { name: "mirror_rapidpay_accounts" },
  { name: "mirror_rapidpay_ledger" },
  { name: "mirror_rapidpay_keys" },
  { name: "mirror_resolution_cases" },
  { name: "mirror_aanris_events" },
];

export default function DatabasePanel() {
  return (
    <div>
      <PanelSection title="Connection">
        <Row
          left={<><DbIcon className="h-3.5 w-3.5 text-[#ff7480]" /><span>Hetzner · Supabase 3</span></>}
          right="standby"
        />
      </PanelSection>

      <PanelSection title="Core Tables" action={<span className="text-[10px] text-muted-foreground/60">{CORE.length}</span>}>
        <div className="flex flex-col">
          {CORE.map((t) => (
            <Row
              key={t.name}
              left={<><Table2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-mono">{t.name}</span></>}
              right={`${t.rows} rows`}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Cross-Product Mirrors" action={<span className="text-[10px] text-muted-foreground/60">{MIRROR.length}</span>}>
        <div className="flex flex-col">
          {MIRROR.map((t) => (
            <Row
              key={t.name}
              left={<><Table2 className="h-3.5 w-3.5 text-[#a855f7]" /><span className="font-mono">{t.name}</span></>}
              right="read-only"
            />
          ))}
        </div>
      </PanelSection>
    </div>
  );
}
