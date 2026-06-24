import { createFileRoute } from "@tanstack/react-router";
import BuilderShell from "@/components/builder/BuilderShell";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "AXONETIS AI Builder™" },
      { name: "description", content: "Founder-only AI builder workspace for AXONETIS." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BuilderShell,
});
