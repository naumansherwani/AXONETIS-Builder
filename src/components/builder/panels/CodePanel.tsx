/**
 * Code panel — LIVE file viewer wired to Supabase 3 `project_files`.
 * File list from fetchProjectFiles(), content from fetchFileContent().
 * Realtime refresh on project_files changes.
 */
import { useEffect, useMemo, useState } from "react";
import { FileCode, FileText, Loader2 } from "lucide-react";
import { PanelSection } from "./PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import {
  fetchProjectFiles,
  fetchFileContent,
  subscribeProjectFiles,
  formatBytes,
  type ProjectFileRow,
} from "@/lib/files-api";
import { SUPABASE3_READY } from "@/integrations/supabase3/client";

export default function CodePanel() {
  const { project } = useBuilder();
  const [rows, setRows] = useState<ProjectFileRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchProjectFiles(project).then((data) => {
        if (!alive) return;
        setRows(data);
        setListLoading(false);
        if (data.length > 0 && !data.find((r) => r.path === selected)) {
          setSelected(data[0].path);
        }
      });
    setListLoading(true);
    load();
    const unsub = subscribeProjectFiles(project, () => load());
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    if (!selected) {
      setContent(null);
      return;
    }
    let alive = true;
    setContentLoading(true);
    fetchFileContent(project, selected)
      .then((r) => {
        if (alive) setContent(r.content);
      })
      .finally(() => {
        if (alive) setContentLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [project, selected]);

  const currentFile = rows.find((r) => r.path === selected);
  const lines = useMemo(() => (content ?? "").split("\n"), [content]);
  const ext = selected?.split(".").pop() ?? "";
  const Icon = ["md", "txt", "mdx"].includes(ext) ? FileText : FileCode;

  return (
    <PanelSection
      title={selected ? selected.split("/").pop()! : "Code"}
      action={
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {currentFile
            ? `${formatBytes(currentFile.size_bytes ?? undefined)} · read-only`
            : "read-only"}
        </span>
      }
    >
      {!SUPABASE3_READY ? (
        <Empty
          title="Supabase 3 offline"
          hint="Set VITE_SUPABASE3_URL + VITE_SUPABASE3_ANON_KEY to load files."
        />
      ) : listLoading ? (
        <div className="flex items-center gap-2 px-2 py-6 text-[11px] text-muted-foreground/70">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading files…
        </div>
      ) : rows.length === 0 ? (
        <Empty title="No files yet" hint={`project_files is empty for "${project}".`} />
      ) : (
        <div className="grid grid-cols-[140px_1fr] gap-2">
          <div className="fb-no-scrollbar max-h-[55vh] overflow-y-auto rounded-md border border-white/[0.06] bg-black/40 p-1">
            {rows.slice(0, 200).map((r) => {
              const name = r.path.split("/").pop() ?? r.path;
              const active = r.path === selected;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.path)}
                  className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] truncate ${
                    active
                      ? "bg-[#E50914]/12 text-foreground"
                      : "text-foreground/75 hover:bg-white/[0.04] hover:text-foreground"
                  }`}
                  title={r.path}
                >
                  <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
          <div className="rounded-md border border-white/[0.06] bg-black/50 p-2">
            {contentLoading ? (
              <div className="flex items-center gap-2 px-2 py-6 text-[11px] text-muted-foreground/70">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : content == null ? (
              <div className="px-2 py-6 text-center text-[11px] text-muted-foreground/60">
                No content stored for this file.
              </div>
            ) : (
              <pre className="fb-no-scrollbar max-h-[55vh] overflow-auto font-mono text-[11px] leading-relaxed">
                {lines.map((l, i) => (
                  <div key={i} className="flex gap-3 hover:bg-white/[0.03]">
                    <span className="w-6 select-none text-right text-muted-foreground/40">
                      {i + 1}
                    </span>
                    <code className="text-foreground/85 whitespace-pre">{l || " "}</code>
                  </div>
                ))}
              </pre>
            )}
          </div>
        </div>
      )}
    </PanelSection>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.01] px-3 py-4 text-center">
      <div className="text-[11px] font-semibold text-foreground/80">{title}</div>
      <div className="mt-1 text-[10px] text-muted-foreground/70">{hint}</div>
    </div>
  );
}
