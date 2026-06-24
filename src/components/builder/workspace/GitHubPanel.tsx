/**
 * Phase A2 — GitHub tab (Monaco diff editor via @monaco-editor/react).
 * Frontend-only viewer for diffs. Branch/commit data wires in Phase A3.
 */
import { useMemo, useState } from "react";
import { GitBranch, GitCommit, ChevronDown } from "lucide-react";
import { DiffEditor, loader } from "@monaco-editor/react";

loader.config({
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
});

const SAMPLE_LEFT = `export default function UnifiedChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  return (
    <div className="flex h-full flex-col">
      <Virtuoso data={messages} itemContent={renderMessage} />
      <Composer />
    </div>
  );
}
`;

const SAMPLE_RIGHT = `export default function UnifiedChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={ref} tabIndex={0} className="flex-1 min-h-0 overflow-y-auto">
        {messages.map((m) => <MessageRow key={m.id} m={m} />)}
      </div>
      <Composer />
    </div>
  );
}
`;

interface FakeFile { path: string; left: string; right: string; status: "M" | "A" | "D"; }
const FILES: FakeFile[] = [
  { path: "src/components/builder/UnifiedChat.tsx", left: SAMPLE_LEFT, right: SAMPLE_RIGHT, status: "M" },
  { path: "src/components/builder/workspace/TerminalPanel.tsx", left: "", right: "// Phase A2 terminal", status: "A" },
  { path: "src/components/builder/workspace/GitHubPanel.tsx",   left: "", right: "// Phase A2 github",   status: "A" },
];

export default function GitHubPanel() {
  const [active, setActive] = useState(0);
  const file = FILES[active];

  const stats = useMemo(() => {
    const add = file.right.split("\n").length - (file.status === "M" ? file.left.split("\n").length : 0);
    return { added: Math.max(0, add), files: FILES.length };
  }, [file]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#040406]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <div className="flex items-center gap-3 text-[11px] text-white/70">
          <button className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 hover:border-[#E50914]/40">
            <GitBranch className="h-3 w-3 text-[#E50914]" /> main <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
          <span className="flex items-center gap-1.5 text-white/50">
            <GitCommit className="h-3 w-3" /> phase A2 · workspace tabs
          </span>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-white/40">
          {stats.files} files · +{stats.added}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-white/[0.015] py-1">
          {FILES.map((f, i) => (
            <button
              key={f.path}
              onClick={() => setActive(i)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition ${
                i === active ? "bg-[#E50914]/10 text-white" : "text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                f.status === "A" ? "bg-green-400" : f.status === "D" ? "bg-[#E50914]" : "bg-amber-400"
              }`} />
              <span className="truncate">{f.path}</span>
            </button>
          ))}
        </aside>
        <div className="min-h-0 flex-1">
          <DiffEditor
            height="100%"
            language="typescript"
            theme="vs-dark"
            original={file.left}
            modified={file.right}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}
