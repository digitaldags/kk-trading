import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  cleanUpE2eDocuments,
  seedDocuments,
  type SeededDocuments,
} from "./helpers";

// The print previews (ticket 23). scripts/e2e-seed-documents.ts makes a completed
// quotation with one delivery receipt, and a draft, all numbered "E2E-…";
// scripts/e2e-cleanup.ts deletes them before and after. Runs after admin-settings,
// away from admin-auth signing out every session.
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const READY = !!process.env.DATABASE_URL && !!EMAIL && !!PASSWORD;
test.skip(!READY, "Needs DATABASE_URL and the E2E_ADMIN_* test account.");

test.describe.configure({ mode: "serial" });

let seeded: SeededDocuments;

test.beforeAll(() => {
  if (!READY) return;
  cleanUpE2eDocuments();
  seeded = seedDocuments();
});

test.afterAll(() => {
  if (READY) cleanUpE2eDocuments();
});

async function signIn(page: Page) {
  await page.goto("/admin/login?next=%2Fadmin");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Serious and critical axe violations fail, as in a11y.spec.ts. */
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  expect(
    results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    label,
  ).toEqual([]);
}

test("signed out, both print pages go to sign-in", async ({ page }) => {
  for (const path of [
    `/admin/print/quotations/${seeded.completed.id}`,
    `/admin/print/receipts/${seeded.receipt.id}`,
  ]) {
    await page.goto(path);
    const url = new URL(page.url());
    expect(url.pathname + url.search).toBe(
      `/admin/login?next=${encodeURIComponent(path)}`,
    );
  }
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the completed quotation prints its number, customer and grand total", async ({
    page,
  }) => {
    await page.goto(`/admin/print/quotations/${seeded.completed.id}`);
    await expect(page).toHaveTitle("Print quotation · Admin");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );

    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("QUOTATION");
    await expect(page.getByText(seeded.completed.number)).toBeVisible();
    await expect(page.getByText("E2E Customer")).toBeVisible();
    await expect(page.getByText("TIN: 010-865-925-000")).toBeVisible();
    await expect(page.getByText(seeded.grandTotal)).toBeVisible();
    await expect(
      page.getByText("FORMAL QUOTATION ACKNOWLEDGEMENT"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Quotation" })).toHaveAttribute(
      "href",
      `/admin/documents/${seeded.completed.id}`,
    );
    await scan(page, "quotation print");

    // Printing shows only the sheet.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
    await expect(page.getByText(seeded.grandTotal)).toBeVisible();
  });

  test("a draft prints with the DRAFT tag", async ({ page }) => {
    await page.goto(`/admin/print/quotations/${seeded.draft.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "QUOTATIONDRAFT",
    );
  });

  test("the delivery receipt prints its own quantity, the notice and the signatures", async ({
    page,
  }) => {
    await page.goto(`/admin/print/receipts/${seeded.receipt.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "DELIVERY RECEIPT",
    );
    await expect(page.getByText(seeded.receipt.number)).toBeVisible();

    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1).getByRole("cell").last()).toHaveText("1");
    await expect(page.getByText("Unit price")).toHaveCount(0);

    await expect(
      page.getByText("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX"),
    ).toBeVisible();
    await expect(page.getByText("PREPARED BY:")).toBeVisible();
    await expect(page.getByText("RECEIVED BY:")).toBeVisible();
    await expect(page.getByText("DATE:")).toBeVisible();
    await scan(page, "receipt print");
  });

  test("an unknown id is not found", async ({ page }) => {
    const response = await page.goto(
      "/admin/print/receipts/00000000-0000-4000-8000-999999999999",
    );
    // Under cacheComponents a production build answers 200 (CLAUDE.md); the page is
    // what counts.
    expect([200, 404]).toContain(response?.status());
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });
});
