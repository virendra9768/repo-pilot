import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror tsconfig `@/* -> ./*` so imports resolve the same as in the app.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    // Never collect the vendored demo repos (they ship their own Jest specs).
    exclude: ["node_modules/**", ".next/**", "demo-repos/**"],
  },
});
