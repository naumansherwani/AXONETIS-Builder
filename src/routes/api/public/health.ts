import { createFileRoute } from "@tanstack/react-router";

// Public, unauthenticated health probe for external monitors / Caddy / uptime checks.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const { healthResponse } = await import("@/lib/health.server");
        return healthResponse();
      },
    },
  },
});
