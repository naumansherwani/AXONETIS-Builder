/**
 * Canonical health payload for AXONETIS Builder.
 * Single source of truth — every health route returns this exact shape.
 */
export type HealthPayload = {
  ok: boolean;
  service: "axonetis-builder";
  status: "ok";
  version: string;
  uptime_s: number;
  time: string;
  endpoints: string[];
};

const BOOTED_AT = Date.now();

export const HEALTH_ENDPOINTS = [
  "/health",
  "/api/health",
  "/api/system/health",
  "/api/public/health",
];

export function buildHealthPayload(): HealthPayload {
  return {
    ok: true,
    service: "axonetis-builder",
    status: "ok",
    version: process.env.APP_VERSION ?? "1.0.0",
    uptime_s: Math.round((Date.now() - BOOTED_AT) / 1000),
    time: new Date().toISOString(),
    endpoints: HEALTH_ENDPOINTS,
  };
}

export function healthResponse(): Response {
  return Response.json(buildHealthPayload(), {
    headers: { "cache-control": "no-store" },
  });
}
