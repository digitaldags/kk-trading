import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    // Component tests opt in to jsdom with `// @vitest-environment jsdom`.
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    setupFiles: ["./vitest.setup.ts"],
    // PGlite tests open, migrate and seed a database in beforeAll/beforeEach. With six
    // migrations (2026-11-03) that went over the 10s default under `pnpm test:coverage`.
    hookTimeout: 30_000,
    // `pnpm test:coverage` (ticket 14): services carry the business rules, so they're held
    // to 90% of lines. The wiring (index.ts) and test helpers don't count.
    coverage: {
      provider: "v8",
      include: ["lib/services/**/*.ts"],
      exclude: [
        "lib/services/index.ts",
        "lib/services/testing/**",
        "**/*.test.ts",
      ],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 90 },
    },
  },
});
