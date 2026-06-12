/**
 * Files panel — project file tree.
 * Phase 2 visual: realistic structure that mirrors Supabase 3 `project_files` shape.
 * Phase 3 wires to live data via Realtime.
 */
import { useState } from "react";
import { ChevronRight, FileCode, FileText, FolderOpen, Folder } from "lucide-react";

type Node =
  | { kind: "dir"; name: string; children: Node[] }
  | { kind: "file"; name: string; ext: string; size: string };

const TREE: Node[] = [
  {
    kind: "dir",
    name: "src",
    children: [
      {
        kind: "dir",
        name: "components",
        children: [
          { kind: "file", name: "Hero.tsx", ext: "tsx", size: "4.2kb" },
          { kind: "file", name: "Pricing.tsx", ext: "tsx", size: "6.1kb" },
          { kind: "file", name: "Footer.tsx", ext: "tsx", size: "2.0kb" },
        ],
      },
      {
        kind: "dir",
        name: "pages",
        children: [
          { kind: "file", name: "index.tsx", ext: "tsx", size: "3.8kb" },
          { kind: "file", name: "dashboard.tsx", ext: "tsx", size: "8.4kb" },
        ],
      },
      { kind: "file", name: "App.tsx", ext: "tsx", size: "1.2kb" },
      { kind: "file", name: "main.tsx", ext: "tsx", size: "0.4kb" },
    ],
  },
  {
    kind: "dir",
    name: "public",
    children: [{ kind: "file", name: "favicon.svg", ext: "svg", size: "1.1kb" }],
  },
  { kind: "file", name: "package.json", ext: "json", size: "1.8kb" },
  { kind: "file", name: "README.md", ext: "md", size: "2.3kb" },
];

export default function FilesPanel() {
  return (
    <div className="text-[12px]">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/80">
          Project Files
        </div>
        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          42 files
        </span>
      </div>
      <Tree nodes={TREE} depth={0} />
    </div>
  );
}

function Tree({ nodes, depth }: { nodes: Node[]; depth: number }) {
  return (
    <div className="flex flex-col">
      {nodes.map((n, i) =>
        n.kind === "dir" ? (
          <DirRow key={`${depth}-${i}`} node={n} depth={depth} />
        ) : (
          <FileRow key={`${depth}-${i}`} node={n} depth={depth} />
        ),
      )}
    </div>
  );
}

function DirRow({ node, depth }: { node: Extract<Node, { kind: "dir" }>; depth: number }) {
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
      {open && <Tree nodes={node.children} depth={depth + 1} />}
    </div>
  );
}

function FileRow({ node, depth }: { node: Extract<Node, { kind: "file" }>; depth: number }) {
  const Icon = ["md", "txt", "mdx"].includes(node.ext) ? FileText : FileCode;
  return (
    <button
      className="flex w-full items-center justify-between gap-2 rounded px-1 py-1 text-left text-foreground/75 hover:bg-white/[0.04] hover:text-foreground"
      style={{ paddingLeft: 8 + depth * 12 + 14 }}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-[12px]">{node.name}</span>
      </span>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">{node.size}</span>
    </button>
  );
}
