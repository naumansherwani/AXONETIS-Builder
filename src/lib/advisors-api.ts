/**
 * Phase 10.12 — Industry Advisor Router client.
 * 8 advisors, @mention routing from the composer.
 *
 * Bridge endpoint (server-snippets/advisors.routes.ts):
 *   POST /rpc/advisor.route { projectId, advisor, prompt } → { advisor, domain, model, answer }
 */
import { rpc } from "./power-tools-api";

export interface Advisor {
  slug: string;
  name: string;
  domain: string;
  tagline: string;
  color: string;
  glyph: string;
}

/** LOCKED advisor roster (cyan family per design lock; per-advisor accent for badges). */
export const ADVISORS: Advisor[] = [
  {
    slug: "aria",
    name: "Aria",
    domain: "Healthcare",
    tagline: "HIPAA, clinical flows, patient data",
    color: "#22d3ee",
    glyph: "A",
  },
  {
    slug: "orion",
    name: "Orion",
    domain: "Finance",
    tagline: "Ledgers, PCI, reconciliation",
    color: "#34d399",
    glyph: "O",
  },
  {
    slug: "rex",
    name: "Rex",
    domain: "Legal",
    tagline: "Contracts, GDPR, compliance",
    color: "#fbbf24",
    glyph: "R",
  },
  {
    slug: "lyra",
    name: "Lyra",
    domain: "Design",
    tagline: "Cinematic UI, motion, brand",
    color: "#f472b6",
    glyph: "L",
  },
  {
    slug: "sage",
    name: "Sage",
    domain: "Education",
    tagline: "Curriculum, onboarding, docs",
    color: "#a855f7",
    glyph: "S",
  },
  {
    slug: "atlas",
    name: "Atlas",
    domain: "Logistics",
    tagline: "Fleet, routing, inventory",
    color: "#60a5fa",
    glyph: "T",
  },
  {
    slug: "vega",
    name: "Vega",
    domain: "Marketing",
    tagline: "Funnels, SEO, outreach copy",
    color: "#fb923c",
    glyph: "V",
  },
  {
    slug: "kai",
    name: "Kai",
    domain: "Infrastructure",
    tagline: "Hetzner, Caddy, PM2, scaling",
    color: "#38bdf8",
    glyph: "K",
  },
];

export function findAdvisor(slug: string | null | undefined): Advisor | null {
  if (!slug) return null;
  const key = slug.toLowerCase().replace(/^@/, "");
  return ADVISORS.find((a) => a.slug === key) ?? null;
}

/** Returns the active @mention token at the caret, or null. */
export function mentionQueryAt(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const upto = text.slice(0, caret);
  const m = /(^|\s)@([a-zA-Z]*)$/.exec(upto);
  if (!m) return null;
  return { query: m[2].toLowerCase(), start: caret - m[2].length - 1 };
}

export function filterAdvisors(query: string): Advisor[] {
  if (!query) return ADVISORS;
  return ADVISORS.filter(
    (a) => a.slug.startsWith(query) || a.domain.toLowerCase().startsWith(query),
  );
}

/** Detects a leading advisor mention in a submitted prompt. */
export function detectMentionedAdvisor(prompt: string): Advisor | null {
  const m = /(?:^|\s)@([a-zA-Z]+)/.exec(prompt);
  return m ? findAdvisor(m[1]) : null;
}

export interface AdvisorAnswer {
  advisor: string;
  domain: string;
  model: string | null;
  answer: string;
}

export async function routeToAdvisor(
  projectId: string,
  advisor: string,
  prompt: string,
): Promise<AdvisorAnswer | null> {
  return rpc<AdvisorAnswer>(`/rpc/advisor.route`, {
    method: "POST",
    body: JSON.stringify({ projectId, advisor, prompt }),
  });
}
