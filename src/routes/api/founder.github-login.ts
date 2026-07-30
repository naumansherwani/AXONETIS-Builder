import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/founder/github-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { username?: string; pat?: string };
        try {
          body = (await request.json()) as { username?: string; pat?: string };
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const username = body.username?.trim() ?? "";
        const pat = body.pat?.trim() ?? "";
        if (!username || !pat) {
          return Response.json(
            { error: "GitHub username aur PAT dono required hain." },
            { status: 400 },
          );
        }

        const { createFounderSession, founderSessionCookie, verifyGithubPat } =
          await import("@/lib/founder-session.server");
        const verified = await verifyGithubPat(username, pat);
        if (!verified.ok) {
          return Response.json({ error: verified.message }, { status: verified.status });
        }

        const token = createFounderSession({
          login: verified.login,
          githubId: verified.githubId,
          name: verified.name,
        });

        return Response.json(
          { ok: true, login: verified.login, name: verified.name },
          { headers: { "Set-Cookie": founderSessionCookie(token, request) } },
        );
      },
    },
  },
});
