import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/founder/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).origin !== new URL(request.url).origin) {
          return Response.json({ error: "Request not allowed." }, { status: 403 });
        }

        let body: { username?: string; password?: string };
        try {
          body = (await request.json()) as { username?: string; password?: string };
        } catch {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }

        const username = body.username?.trim() ?? "";
        const password = body.password ?? "";
        if (!username || !password || username.length > 64 || password.length > 256) {
          return Response.json(
            { error: "Username and password are required." },
            { status: 400 },
          );
        }

        const {
          checkFounderLoginLimit,
          clearFounderLoginFailures,
          createFounderSession,
          founderSessionCookie,
          recordFounderLoginFailure,
          verifyFounderCredentials,
        } = await import("@/lib/founder-session.server");
        const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
        const loginKey = forwardedFor || request.headers.get("cf-connecting-ip") || "unknown";
        const limit = checkFounderLoginLimit(loginKey);
        if (!limit.allowed) {
          return Response.json(
            { error: "Too many attempts. Please try again shortly." },
            {
              status: 429,
              headers: {
                "Cache-Control": "no-store",
                "Retry-After": String(limit.retryAfter),
              },
            },
          );
        }
        if (!verifyFounderCredentials(username, password)) {
          recordFounderLoginFailure(loginKey);
          return Response.json(
            { error: "Invalid username or password." },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }

        clearFounderLoginFailures(loginKey);
        const token = createFounderSession({ login: username });
        return Response.json(
          { ok: true, login: username },
          {
            headers: {
              "Cache-Control": "no-store",
              "Set-Cookie": founderSessionCookie(token, request),
            },
          },
        );
      },
    },
  },
});