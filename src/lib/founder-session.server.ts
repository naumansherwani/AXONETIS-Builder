import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FOUNDER_SESSION_COOKIE = "axon_founder_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type FounderSession = {
  sub: string;
  login: string;
  iat: number;
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.FOUNDER_SESSION_SECRET;

  if (!secret || secret.length < 32) {
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

export function createFounderSession(input: { login: string }) {
  const now = Math.floor(Date.now() / 1000);
  const session: FounderSession = {
    sub: `founder:${input.login.toLowerCase()}`,
    login: input.login.toLowerCase(),
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
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as FounderSession;
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    if (!session.login || !session.sub.startsWith("founder:")) return null;
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

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function verifyFounderCredentials(username: string, password: string) {
  const expectedUsername = process.env.FOUNDER_USERNAME || "naumansherwani";
  const expectedPassword = process.env.FOUNDER_PASSWORD;
  if (!expectedPassword) {
    throw new Error("FOUNDER_PASSWORD is not configured on the builder server.");
  }
  return (
    timingSafeEqual(digest(username.trim().toLowerCase()), digest(expectedUsername.toLowerCase())) &&
    timingSafeEqual(digest(password), digest(expectedPassword))
  );
}

function stableUuidFromLogin(login: string) {
  const hex = createHash("sha256")
    .update(`axonetis-founder:${login.toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function resolveFounderUserId(supabase: SupabaseClient, session: FounderSession) {
  const configured = process.env.FOUNDER_AUTH_USER_ID || process.env.SUPABASE3_FOUNDER_USER_ID;
  if (configured) return configured;

  const founderEmails = (
    process.env.FOUNDER_AUTH_EMAILS ||
    "naumansherwani@nexatect.com,naumankhansherwani@gmail.com,hostflowaibuilder@gmail.com"
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const { data } = await supabase.auth.admin
    .listUsers({ page: 1, perPage: 1000 })
    .catch(() => ({ data: null }));
  const user = data?.users?.find((candidate) =>
    founderEmails.includes((candidate.email ?? "").toLowerCase()),
  );
  return user?.id ?? stableUuidFromLogin(session.login);
}
