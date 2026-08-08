/**
 * PHASE 12.3 — HELP CENTER API.
 * Reads `help_articles` from Supabase 3 (self-hosted). Fuzzy search is done
 * client-side so it is instant; no dummy articles are ever injected.
 */
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

export const HELP_CATEGORIES = ["Getting Started", "API", "Billing", "Security"] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number] | string;

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  category: HelpCategory;
  summary: string | null;
  body_md: string;
  video_url: string | null;
  updated_at: string;
}

export interface HelpSnapshot {
  articles: HelpArticle[];
  live: boolean;
  error?: string;
}

export async function fetchHelpArticles(): Promise<HelpSnapshot> {
  if (!SUPABASE3_READY)
    return { articles: [], live: false, error: "Supabase 3 not configured" };
  const { data, error } = await supabase3
    .from("help_articles")
    .select("*")
    .eq("is_published", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return { articles: [], live: false, error: error.message };
  return {
    articles: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      slug: String(r.slug ?? r.id),
      title: String(r.title ?? "Untitled"),
      category: String(r.category ?? "Getting Started"),
      summary: (r.summary as string | null) ?? null,
      body_md: String(r.body_md ?? ""),
      video_url: (r.video_url as string | null) ?? null,
      updated_at: String(r.updated_at ?? new Date().toISOString()),
    })),
    live: true,
  };
}

/** Subsequence fuzzy match — "gts" matches "Getting Started". Returns a score (lower = better). */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return t.indexOf(q);
  let ti = 0;
  let gaps = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    gaps += found - ti;
    ti = found + 1;
  }
  return 100 + gaps;
}

export function searchArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  if (!query.trim()) return articles;
  return articles
    .map((a) => {
      const scores = [
        fuzzyScore(query, a.title),
        fuzzyScore(query, a.category),
        fuzzyScore(query, a.summary ?? ""),
        fuzzyScore(query, a.body_md.slice(0, 4000)),
      ].filter((s): s is number => s !== null);
      return scores.length ? { a, score: Math.min(...scores) } : null;
    })
    .filter((x): x is { a: HelpArticle; score: number } => x !== null)
    .sort((x, y) => x.score - y.score)
    .map((x) => x.a);
}

/** YouTube / Vimeo → embeddable URL. Anything else returns null (no unsafe embeds). */
export function toEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
