import { createFileRoute } from "@tanstack/react-router";
import BuilderShell from "@/components/builder/BuilderShell";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Founder AI Builder™" },
      { name: "description", content: "Founder AI Builder — sovereign AI development workspace." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BuilderShell,
});
