// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Hetzner runs Node (pm2), NOT Cloudflare Workers — override the default
  // nitro preset so the build emits a Node server at .output/server/index.mjs
  // which is what `node .output/server/index.mjs` (start script) runs.
  nitro: {
    preset: "node-server",
  },
  vite: {
    server: {
      allowedHosts: ["aiaxonetis.nexatect.com", ".nexatect.com"],
      host: "0.0.0.0",
    },
    preview: {
      allowedHosts: ["aiaxonetis.nexatect.com", ".nexatect.com"],
      host: "0.0.0.0",
    },
  },
});
