/**
 * Files API — reads project_files from Supabase 3 (truth table).
 * Falls back to empty when Supabase 3 not configured.
 *
 * project_files schema (per Phase 1 SQL): { id, project_id, path, content, size_bytes, updated_at }
 */
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";
import type { ProjectId } from "./projects";

export interface ProjectFileRow {
  id: string;
  path: string;
  size_bytes: number | null;
  updated_at: string;
}

export interface FileTreeNode {
  kind: "dir" | "file";
  name: string;
  path: string;
  size?: number;
  children?: FileTreeNode[];
}

export async function fetchProjectFiles(projectId: ProjectId): Promise<ProjectFileRow[]> {
  if (!SUPABASE3_READY) return [];
  const { data, error } = await supabase3
    .from("project_files")
    .select("id, path, size_bytes, updated_at")
    .eq("project_id", projectId)
    .order("path", { ascending: true })
    .limit(2000);
  if (error) {
    console.warn("[files-api] fetch failed:", error.message);
    return [];
  }
  return (data ?? []) as ProjectFileRow[];
}

/** Fetch a single file's content from Supabase 3 project_files. */
export async function fetchFileContent(
  projectId: ProjectId,
  path: string,
): Promise<{ content: string | null; updated_at: string | null; size: number | null }> {
  if (!SUPABASE3_READY) return { content: null, updated_at: null, size: null };
  const { data, error } = await supabase3
    .from("project_files")
    .select("content, size_bytes, updated_at")
    .eq("project_id", projectId)
    .eq("path", path)
    .maybeSingle();
  if (error) {
    console.warn("[files-api] content fetch failed:", error.message);
    return { content: null, updated_at: null, size: null };
  }
  return {
    content: (data?.content as string | null) ?? null,
    updated_at: (data?.updated_at as string | null) ?? null,
    size: (data?.size_bytes as number | null) ?? null,
  };
}

/** Turn a flat list of paths into a nested tree. */
export function buildTree(rows: ProjectFileRow[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  for (const row of rows) {
    const parts = row.path.split("/").filter(Boolean);
    let cursor = root;
    parts.forEach((seg, i) => {
      const isLast = i === parts.length - 1;
      const existing = cursor.find(
        (n) => n.name === seg && (isLast ? n.kind === "file" : n.kind === "dir"),
      );
      if (existing) {
        if (!isLast && existing.children) cursor = existing.children;
        return;
      }
      const node: FileTreeNode = isLast
        ? { kind: "file", name: seg, path: row.path, size: row.size_bytes ?? undefined }
        : { kind: "dir", name: seg, path: parts.slice(0, i + 1).join("/"), children: [] };
      cursor.push(node);
      if (!isLast && node.children) cursor = node.children;
    });
  }
  // dirs first, then files, alphabetical
  const sort = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.children && sort(n.children));
  };
  sort(root);
  return root;
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes == null || bytes < 0) return "";
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kb`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
}

/** Subscribe to project_files realtime changes. Returns unsubscribe. */
export function subscribeProjectFiles(projectId: ProjectId, onChange: () => void): () => void {
  if (!SUPABASE3_READY) return () => {};
  const channel = supabase3
    .channel(`project_files:${projectId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "project_files",
        filter: `project_id=eq.${projectId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase3.removeChannel(channel);
  };
}
