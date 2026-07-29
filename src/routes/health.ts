import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        const { healthResponse } = await import("@/lib/health.server");
        return healthResponse();
      },
    },
  },
});
