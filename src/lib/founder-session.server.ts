import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FOUNDER_SESSION_COOKIE = "axon_founder_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type FounderSession = {
  sub: string;
  login: string;
  githubId: number;
  name?: string | null;
  iat: number;
  exp: number;
};

function getSessionSecret() {
  const secret =
    process.env.FOUNDER_GITHUB_SESSION_SECRET ||
    process.env.SUPABASE3_SERVICE_ROLE_KEY ||
    process.env.SUPABASE3_ANON_KEY;

  if (!secret || secret.length < 16) {
    throw new Error("Founder session secret is not configured on the builder server.");
  }
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function parseCookies(header: string | null) {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function createFounderSession(input: { login: string; githubId: number; name?: string | null }) {
  const now = Math.floor(Date.now() / 1000);
  const session: FounderSession = {
    sub: `github:${input.githubId}`,
    login: input.login,
    githubId: input.githubId,
    name: input.name ?? null,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyFounderSession(token: string | undefined | null): FounderSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as FounderSession;
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    if (!session.login || !session.githubId) return null;
    return session;
  } catch {
    return null;
  }
}

export function readFounderSession(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return verifyFounderSession(cookies[FOUNDER_SESSION_COOKIE]);
}

export function founderSessionCookie(token: string, request: Request) {
  const host = new URL(request.url).hostname;
  const secure = host !== "localhost" && host !== "127.0.0.1";
  return [
    `${FOUNDER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearFounderSessionCookie() {
  return `${FOUNDER_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export async function verifyGithubPat(username: string, pat: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "AXONETIS-AI-Builder",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    return { ok: false as const, status: response.status, message: "GitHub username ya PAT invalid hai." };
  }

  const profile = (await response.json()) as { id?: number; login?: string; name?: string | null };
  if (!profile.id || !profile.login) {
    return { ok: false as const, status: 401, message: "GitHub profile verify nahi hua." };
  }

  if (profile.login.toLowerCase() !== username.trim().toLowerCase()) {
    return { ok: false as const, status: 401, message: "Username is PAT ke GitHub account se match nahi karta." };
  }

  const allowlist = (process.env.FOUNDER_GITHUB_USERS || process.env.FOUNDER_GITHUB_USERNAME || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length && !allowlist.includes(profile.login.toLowerCase())) {
    return { ok: false as const, status: 403, message: "Yeh GitHub account founder allowlist mein nahi hai." };
  }

  return { ok: true as const, login: profile.login, githubId: profile.id, name: profile.name ?? null };
}

function stableUuidFromGithubId(githubId: number) {
  const hex = createHash("sha256").update(`axon-founder-github:${githubId}`).digest("hex").slice(0, 32);
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function resolveFounderUserId(supabase: SupabaseClient, session: FounderSession) {
  const configured = process.env.FOUNDER_AUTH_USER_ID || process.env.SUPABASE3_FOUNDER_USER_ID;
  if (configured) return configured;

  const founderEmails = (process.env.FOUNDER_AUTH_EMAILS ||
    "naumansherwani@nexatect.com,naumankhansherwani@gmail.com,hostflowaibuilder@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: null }));
  const user = data?.users?.find((candidate) => founderEmails.includes((candidate.email ?? "").toLowerCase()));
  return user?.id ?? stableUuidFromGithubId(session.githubId);
}