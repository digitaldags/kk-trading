import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Locally, .env.local points at the Neon dev branch, so the data specs can run. CI sets
// DATABASE_URL to a throwaway Neon branch (.github/workflows/ci.yml); without one, those
// specs skip themselves (see e2e/storefront.spec.ts).
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const isCI = !!process.env.CI;

/** Specs run at 1440×900 and again at 390×844 (ticket 14). */
const BOTH_VIEWPORTS = ["flows", "a11y"];

/** Specs that change shared data, in the order they run (see `projects`). */
const ADMIN_WRITES = [
  "admin-products",
  "admin-categories",
  "admin-publish",
  "admin-settings",
];

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
      testIgnore: [
        ...ADMIN_WRITES.map((spec) => `${spec}.spec.ts`),
        ...BOTH_VIEWPORTS.map((spec) => `${spec}.spec.ts`),
      ],
    },
    // The specs that change shared data run after the rest, one after another: they add
    // and delete products and categories (which would change the counts the storefront
    // specs check), rename the store, and change the password (which signs out every
    // session of the account, admin-auth's included).
    ...ADMIN_WRITES.map((spec, index) => ({
      name: spec,
      use: { ...devices["Desktop Chrome"] },
      testMatch: `${spec}.spec.ts`,
      dependencies: [index === 0 ? "chromium" : ADMIN_WRITES[index - 1]!],
    })),
    // Ticket 14: the core flows and the axe scans at both viewports, last, one viewport
    // after the other (the flows publish).
    {
      name: "flows-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: BOTH_VIEWPORTS.map((spec) => `${spec}.spec.ts`),
      dependencies: [ADMIN_WRITES.at(-1)!],
    },
    {
      name: "flows-mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: BOTH_VIEWPORTS.map((spec) => `${spec}.spec.ts`),
      dependencies: ["flows-desktop"],
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
