import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Axe scans (ticket 14) of the storefront and admin, run at 1440×900 and 390×844 (the
// flows-desktop and flows-mobile projects). Serious and critical violations fail;
// anything milder is printed so it isn't lost.
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
test.skip(
  !process.env.DATABASE_URL || !EMAIL || !PASSWORD,
  "Needs DATABASE_URL and the E2E_ADMIN_* test account.",
);

async function scan(page: Page, label: string) {
  // Let entrance animations finish, so colors are checked as people see them.
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  for (const v of results.violations) {
    if (!blocking.includes(v)) {
      console.log(`[${label}] ${v.impact}: ${v.id} (${v.nodes.length})`);
    }
  }
  expect(
    blocking.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(" ")),
    })),
    label,
  ).toEqual([]);
}

async function signIn(page: Page) {
  await page.goto("/admin/login?next=%2Fadmin");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("the storefront", async ({ page }) => {
  await page.goto("/");
  await scan(page, "/");
});

test("a product page", async ({ page }) => {
  await page.goto("/products/olympic-barbell-20-kg");
  await scan(page, "/products/olympic-barbell-20-kg");
});

test("the product dialog", async ({ page }) => {
  await page.goto("/");
  await page
    .locator("#catalog")
    .getByRole("link", { name: "Olympic barbell 20 kg", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Olympic barbell 20 kg" }),
  ).toBeVisible();
  await scan(page, "product dialog");
});

test("the sign-in page", async ({ page }) => {
  await page.goto("/admin/login");
  await scan(page, "/admin/login");
});

test("the admin pages and editors", async ({ page }) => {
  await signIn(page);
  await scan(page, "/admin");

  await page.goto("/admin?new=1");
  await expect(page.getByRole("dialog", { name: "Add product" })).toBeVisible();
  await scan(page, "product editor");

  await page.goto("/admin/categories");
  await scan(page, "/admin/categories");

  await page.goto("/admin/categories?new=1");
  await expect(
    page.getByRole("dialog", { name: "Add category" }),
  ).toBeVisible();
  await scan(page, "category editor");

  await page.goto("/admin/settings");
  await scan(page, "/admin/settings");
});
