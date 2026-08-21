import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/founder/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { readFounderSession } = await import("@/lib/founder-session.server");
        const session = readFounderSession(request);
        if (!session) return Response.json({ authenticated: false }, { status: 401 });
        return Response.json({
          authenticated: true,
          user: { login: session.login, provider: "axonetis" },
        }, { headers: { "Cache-Control": "no-store" } });
      },
      DELETE: async () => {
        const { clearFounderSessionCookie } = await import("@/lib/founder-session.server");
        return Response.json(
          { ok: true },
          { headers: { "Set-Cookie": clearFounderSessionCookie() } },
        );
      },
    },
  },
});
