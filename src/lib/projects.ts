/**
 * Project registry — Founder AI Builder™
 * Each project = one of the founder's products. Preview URL drives the iframe.
 * Phase 1: static registry. Phase 2+: read from Supabase 3 `projects` table.
 */
export type ProjectId = "hostflowai" | "rapidpay" | "founderbuilder";

export interface ProjectDef {
  id: ProjectId;
  name: string;
  shortName: string;
  previewUrl: string;
  accent: string; // hex
}

export const PROJECTS: ProjectDef[] = [
  {
    id: "hostflowai",
    name: "HostFlow AI™",
    shortName: "HostFlow",
    previewUrl: "https://hostflowai.net",
    accent: "#E50914",
  },
  {
    id: "rapidpay",
    name: "Rapid Pay™",
    shortName: "Rapid Pay",
    previewUrl: "https://rapidpay.hostflowai.net",
    accent: "#7c3aed",
  },
  {
    id: "founderbuilder",
    name: "Founder AI Builder™",
    shortName: "Builder",
    previewUrl: "https://founderaibuilder.hostflowai.net",
    accent: "#1a0933",
  },
];

export const DEFAULT_PROJECT: ProjectId = "hostflowai";

export const BRANCHES = ["main", "staging", "preview"] as const;
export type Branch = (typeof BRANCHES)[number];

export const ENVIRONMENTS = ["Sandbox", "Staging", "Production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];
