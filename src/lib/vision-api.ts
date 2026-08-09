/**
 * Phase 10.4 — Screenshot Vision client.
 *
 * Bridge endpoints (Hetzner, server-snippets/vision.routes.ts):
 *   POST /rpc/vision.upload   { projectId, filename, mime, dataUrl } → VisionShot
 *   GET  /rpc/vision.list?projectId                                 → { shots }
 *   POST /rpc/vision.analyze  { projectId, shotId }                 → VisionAnalysis
 *   POST /rpc/vision.apply    { projectId, shotId, suggestionId }   → { ok, diff_id }
 *
 * NO DUPLICATE: reuses the shared bridge rpc<T>() helper from power-tools-api.
 */
import { rpc } from "./power-tools-api";

export interface VisionShot {
  id: string;
  filename: string;
  url: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  analyzed: boolean;
}

/** Detected UI element box in *normalized* 0..1 coordinates. */
export interface VisionElement {
  id: string;
  label: string; // "button", "nav", "hero", "card"…
  confidence: number; // 0..100
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VisionSuggestion {
  id: string;
  index: number; // 1-based, for numbered list
  title: string;
  detail: string;
  path: string | null; // target file, when known
  elementId: string | null; // links to VisionElement
  severity: "info" | "improve" | "fix";
}

export interface VisionAnalysis {
  shotId: string;
  model: string | null;
  summary: string;
  elements: VisionElement[];
  suggestions: VisionSuggestion[];
  created_at: string;
}

export const VISION_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export function isSupportedImage(file: File): boolean {
  return /^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type);
}

export function fileToDataUrl(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    reader.onload = () => {
      onProgress?.(100);
      resolve(String(reader.result));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export async function uploadShot(
  projectId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<VisionShot | null> {
  const dataUrl = await fileToDataUrl(file, (p) => onProgress?.(Math.round(p * 0.6)));
  const res = await rpc<VisionShot>("/rpc/vision.upload", {
    method: "POST",
    body: JSON.stringify({ projectId, filename: file.name, mime: file.type, dataUrl }),
  });
  onProgress?.(100);
  return res;
}

export async function listShots(projectId: string): Promise<VisionShot[]> {
  const res = await rpc<{ shots?: VisionShot[] }>(
    `/rpc/vision.list?projectId=${encodeURIComponent(projectId)}`,
  );
  return Array.isArray(res?.shots) ? res!.shots! : [];
}

export async function analyzeShot(
  projectId: string,
  shotId: string,
): Promise<VisionAnalysis | null> {
  return rpc<VisionAnalysis>("/rpc/vision.analyze", {
    method: "POST",
    body: JSON.stringify({ projectId, shotId }),
  });
}

export async function applySuggestion(
  projectId: string,
  shotId: string,
  suggestionId: string,
): Promise<{ ok: boolean; diff_id?: string; error?: string } | null> {
  return rpc("/rpc/vision.apply", {
    method: "POST",
    body: JSON.stringify({ projectId, shotId, suggestionId }),
  });
}

const ELEMENT_TONES = [
  "#E50914",
  "#a855f7",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#60a5fa",
];

export function elementColor(index: number): string {
  return ELEMENT_TONES[index % ELEMENT_TONES.length];
}
