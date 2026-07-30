/**
 * Storage API — Hetzner brain: buckets + objects listing.
 * Endpoints: GET /api/agents/founder/storage/buckets
 *            GET /api/agents/founder/storage/objects?bucket=<name>&limit=50
 * Offline-safe: returns { live:false, buckets:[] } on failure.
 */
const BASE =
  (import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export interface StorageBucket {
  name: string;
  public: boolean;
  objectCount: number;
  totalBytes: number;
  createdAt?: string;
}

export interface StorageObject {
  key: string;
  size: number;
  contentType?: string;
  updatedAt?: string;
}

export interface StorageSnapshot {
  live: boolean;
  buckets: StorageBucket[];
  fetchedAt: string;
}

export async function fetchBuckets(): Promise<StorageSnapshot> {
  const fetchedAt = new Date().toISOString();
  if (!BASE) return { live: false, buckets: [], fetchedAt };
  try {
    const res = await fetch(`${BASE}/api/agents/founder/storage/buckets`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { live: false, buckets: [], fetchedAt };
    const j = await res.json();
    const buckets: StorageBucket[] = Array.isArray(j.buckets) ? j.buckets : [];
    return { live: true, buckets, fetchedAt };
  } catch {
    return { live: false, buckets: [], fetchedAt };
  }
}

export async function fetchObjects(bucket: string, limit = 50): Promise<StorageObject[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(
      `${BASE}/api/agents/founder/storage/objects?bucket=${encodeURIComponent(bucket)}&limit=${limit}`,
      { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } },
    );
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j.objects) ? j.objects : [];
  } catch {
    return [];
  }
}
