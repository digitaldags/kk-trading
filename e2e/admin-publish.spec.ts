import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { publish } from "./helpers";

// Draft and publish (ticket 15) against the Neon dev branch: admin edits stay off the
// store until Publish, and Discard puts the draft back. Uses its own "E2E publish …"
// product and deletes it again. In CI it runs on a throwaway Neon branch.
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
test.skip(
  !process.env.DATABASE_URL || !EMAIL || !PASSWORD,
  "Needs DATABASE_URL and the E2E_ADMIN_* test account.",
);

test.describe.configure({ mode: "serial" });

const RUN = Date.now();
const NAME = `E2E publish ${RUN}`;
const DRAFT_NAME = `${NAME} draft`;

test.beforeAll(() => {
  if (!process.env.DATABASE_URL || !EMAIL || !PASSWORD) return;
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/e2e-cleanup.ts"],
    { stdio: "ignore" },
  );
});

async function signIn(page: Page) {
  await page.goto("/admin/login?next=%2Fadmin");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const snackbar = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

const storeCard = (page: Page, name: string) =>
  page.locator("#catalog").getByRole("link", { name, exact: true });

async function addProduct(page: Page, name: string) {
  await page.getByRole("link", { name: "Add product" }).click();
  const dialog = page.getByRole("dialog", { name: "Add product" });
  await dialog.getByLabel("Product name").fill(name);
  await dialog.getByLabel("Price").fill("500");
  await dialog.getByRole("button", { name: "Add product" }).click();
  await expect(snackbar(page, `Added ${name}.`)).toBeVisible();
}

async function rename(page: Page, from: string, to: string) {
  await page.getByRole("button", { name: `Edit ${from}` }).click();
  const dialog = page.getByRole("dialog", { name: "Edit product" });
  await dialog.getByLabel("Product name").fill(to);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(snackbar(page, `Saved ${to}.`)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("edits aren't visible on the store until Publish", async ({ page }) => {
  await addProduct(page, NAME);
  await expect(page.getByText("Unpublished changes")).toBeVisible();

  await page.goto(`/?q=${encodeURIComponent(NAME)}`);
  await expect(storeCard(page, NAME)).toHaveCount(0);

  await page.goto("/admin");
  await publish(page);
  await page.goto(`/?q=${encodeURIComponent(NAME)}`);
  await expect(storeCard(page, NAME)).toBeVisible();

  // A rename is a draft too.
  await page.goto("/admin");
  await rename(page, NAME, DRAFT_NAME);
  await page.goto(`/?q=${encodeURIComponent(NAME)}`);
  await expect(storeCard(page, NAME)).toBeVisible();
  await expect(storeCard(page, DRAFT_NAME)).toHaveCount(0);
});

test("Discard puts the draft back to what's published", async ({ page }) => {
  // From the last test: the product is published as NAME, renamed to DRAFT_NAME in the
  // draft. Add another product to the draft as well.
  const added = `${NAME} added`;
  await addProduct(page, added);

  await page
    .getByRole("region", { name: "Unpublished changes" })
    .getByRole("button", { name: "Discard" })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Discard unpublished changes?",
  });
  await confirm.getByRole("button", { name: "Discard changes" }).click();
  await expect(snackbar(page, "Changes discarded.")).toBeVisible();
  await expect(page.getByText("All changes live")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Unpublished changes" }),
  ).toHaveCount(0);

  const products = page.getByRole("list", { name: "Products" });
  await expect(products.getByText(NAME, { exact: true })).toBeVisible();
  await expect(products.getByText(DRAFT_NAME, { exact: true })).toHaveCount(0);
  await expect(products.getByText(added, { exact: true })).toHaveCount(0);

  // The store never changed.
  await page.goto(`/?q=${encodeURIComponent(NAME)}`);
  await expect(storeCard(page, NAME)).toBeVisible();
  await expect(storeCard(page, added)).toHaveCount(0);
});

test("deleting is a draft too, until it's published", async ({ page }) => {
  await page.getByRole("button", { name: `Delete ${NAME}` }).click();
  await page
    .getByRole("dialog", { name: `Delete ${NAME}?` })
    .getByRole("button", { name: "Delete product" })
    .click();
  await expect(snackbar(page, `Deleted ${NAME}.`)).toBeVisible();

  await page.goto(`/?q=${encodeURIComponent(NAME)}`);
  await expect(storeCard(page, NAME)).toBeVisible();

  await page.goto("/admin");
  await publish(page);
  await page.goto(`/?q=${encodeURIComponent(NAME)}`);
  await expect(storeCard(page, NAME)).toHaveCount(0);
});
