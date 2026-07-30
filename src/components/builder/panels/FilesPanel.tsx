/**
 * Files panel — LIVE wiring to Supabase 3 `project_files`.
 * Realtime subscription refreshes on any insert/update/delete.
 * Falls back to a clear empty state when Supabase 3 not configured.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileCode, FileText, FolderOpen, Folder, Loader2 } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import {
  fetchProjectFiles,
  buildTree,
  subscribeProjectFiles,
  formatBytes,
  type FileTreeNode,
  type ProjectFileRow,
} from "@/lib/files-api";
import { SUPABASE3_READY } from "@/integrations/supabase3/client";

export default function FilesPanel() {
  const { project } = useBuilder();
  const [rows, setRows] = useState<ProjectFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(rows), [rows]);
  const totalFiles = rows.length;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchProjectFiles(project)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    const unsub = subscribeProjectFiles(project, () => {
      fetchProjectFiles(project)
        .then((data) => alive && setRows(data))
        .catch(() => {});
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [project]);

  return (
    <div className="text-[12px]">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/80">
          Project Files
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70" />}
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {totalFiles} {totalFiles === 1 ? "file" : "files"}
          </span>
        </div>
      </div>

      {!SUPABASE3_READY && (
        <EmptyState
          title="Supabase 3 offline"
          hint="Set VITE_SUPABASE3_URL + VITE_SUPABASE3_ANON_KEY to load real project_files."
        />
      )}
      {SUPABASE3_READY && !loading && rows.length === 0 && !error && (
        <EmptyState title="No files yet" hint={`project_files table is empty for "${project}".`} />
      )}
      {error && <EmptyState title="Load failed" hint={error} tone="error" />}
      {tree.length > 0 && <Tree nodes={tree} depth={0} />}
    </div>
  );
}

function EmptyState({ title, hint, tone }: { title: string; hint: string; tone?: "error" }) {
  return (
    <div
      className={`rounded-md border px-3 py-4 text-center ${
        tone === "error"
          ? "border-red-500/20 bg-red-500/[0.03]"
          : "border-white/[0.05] bg-white/[0.01]"
      }`}
    >
      <div
        className={`text-[11px] font-semibold ${tone === "error" ? "text-red-300" : "text-foreground/80"}`}
      >
        {title}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground/70">{hint}</div>
    </div>
  );
}

function Tree({ nodes, depth }: { nodes: FileTreeNode[]; depth: number }) {
  return (
    <div className="flex flex-col">
      {nodes.map((n) =>
        n.kind === "dir" ? (
          <DirRow key={n.path} node={n} depth={depth} />
        ) : (
          <FileRow key={n.path} node={n} depth={depth} />
        ),
      )}
    </div>
  );
}

function DirRow({ node, depth }: { node: FileTreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-foreground/85 hover:bg-white/[0.04]"
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
        {open ? (
          <FolderOpen className="h-3.5 w-3.5 text-[#ff9aa0]" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-[#ff7480]" />
        )}
        <span className="truncate text-[12px]">{node.name}</span>
      </button>
      {open && node.children && <Tree nodes={node.children} depth={depth + 1} />}
    </div>
  );
}

function FileRow({ node, depth }: { node: FileTreeNode; depth: number }) {
  const ext = node.name.split(".").pop() ?? "";
  const Icon = ["md", "txt", "mdx"].includes(ext) ? FileText : FileCode;
  return (
    <button
      className="flex w-full items-center justify-between gap-2 rounded px-1 py-1 text-left text-foreground/75 hover:bg-white/[0.04] hover:text-foreground"
      style={{ paddingLeft: 8 + depth * 12 + 14 }}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-[12px]">{node.name}</span>
      </span>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
        {formatBytes(node.size)}
      </span>
    </button>
  );
}
