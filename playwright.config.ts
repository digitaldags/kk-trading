import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Locally, .env.local points at the Neon dev branch, so the storefront specs can run.
// CI has no database yet; those specs skip themselves (see e2e/storefront.spec.ts).
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: "admin-products.spec.ts",
    },
    // Runs after the rest: it adds and deletes products, which would change the counts
    // the storefront specs check, and admin-auth signs out every session of the account.
    {
      name: "admin-products",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "admin-products.spec.ts",
      dependencies: ["chromium"],
    },
  ],
  webServer: {
    // CI runs `pnpm build` first, then tests the production server.
    command: isCI ? "pnpm start" : "pnpm dev",
    // Wait on a page that renders without a database. Without one (CI), the storefront
    // answers 500, which Playwright reads as "not ready" until it times out.
    url: "http://localhost:3000/styleguide",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
