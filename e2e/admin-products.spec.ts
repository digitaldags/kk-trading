import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { publish } from "./helpers";

// The products admin against the Neon dev branch (and the Blob store in .env.local for
// the photo test). Each run adds its own products (named with a timestamp) and deletes
// them again, so the seeded samples are never touched. In CI it runs on a throwaway Neon
// branch (README › Tests), and skips without its secrets.
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
test.skip(
  !process.env.DATABASE_URL || !EMAIL || !PASSWORD,
  "Needs DATABASE_URL and the E2E_ADMIN_* test account.",
);

// The tests build on each other: add, edit, then delete the same product.
test.describe.configure({ mode: "serial" });

const RUN = Date.now();
const NAME = `E2E product ${RUN}`;
const RENAMED = `${NAME} v2`;

/** A small PNG drawn by the browser, so the upload has a real image to resize. */
async function pngFile(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 30;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "teal";
    context.fillRect(0, 0, 40, 30);
    return canvas.toDataURL("image/png");
  });
  return {
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.split(",")[1]!, "base64"),
  };
}

async function signIn(page: Page) {
  await page.goto("/admin/login?next=%2Fadmin");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const snackbar = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

const row = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Products" })
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });

// Clear products an interrupted run left behind, so the storefront counts stay the seed's.
test.beforeAll(() => {
  if (!process.env.DATABASE_URL || !EMAIL || !PASSWORD) return;
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/e2e-cleanup.ts"],
    { stdio: "ignore" },
  );
});

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the admin shell, tabs and search", async ({ page }) => {
  await expect(page).toHaveTitle("Products · Admin");
  await expect(
    page.getByRole("link", { name: "Products", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Back to store" })).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Search products" })
    .fill("zzz-none");
  await expect(page).toHaveURL(/\/admin\?q=zzz-none$/);
  await expect(page.getByText("No products match “zzz-none”")).toBeVisible();

  await page.getByRole("link", { name: "Categories" }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await expect(page.getByRole("link", { name: "Categories" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("adding a product shows it in the list and on the store", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Add product" }).click();
  await expect(page).toHaveURL(/\/admin\?new=1$/);
  const dialog = page.getByRole("dialog", { name: "Add product" });
  await dialog.getByLabel("Product name").fill(NAME);
  await dialog.getByLabel("Price").fill("1,250");
  await dialog.getByRole("button", { name: "Low stock" }).click();
  await dialog.getByLabel("Key spec").fill("Made by the e2e tests");
  await dialog.getByRole("button", { name: "Add product" }).click();

  await expect(snackbar(page, `Added ${NAME}.`)).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(dialog).toBeHidden();
  await expect(row(page, NAME)).toContainText("₱1,250");

  // Saves are a draft: the store shows the product once it's published.
  await publish(page);
  await page.goto(`/?q=${encodeURIComponent(NAME)}`);
  await expect(page.getByRole("link", { name: NAME })).toBeVisible();
});

test("a photo uploads to Blob and shows on the store", async ({ page }) => {
  test.skip(
    !process.env.BLOB_READ_WRITE_TOKEN,
    "Needs BLOB_READ_WRITE_TOKEN for the Vercel Blob store.",
  );
  await row(page, NAME)
    .getByRole("button", { name: `Edit ${NAME}` })
    .click();
  const dialog = page.getByRole("dialog", { name: "Edit product" });
  await dialog.locator('input[type="file"]').setInputFiles(await pngFile(page));
  await expect(
    dialog.getByRole("img", { name: "Product photo" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(snackbar(page, `Saved ${NAME}.`)).toBeVisible();
  await expect(row(page, NAME).locator("img")).toHaveAttribute(
    "src",
    /public\.blob\.vercel-storage\.com/,
  );

  await publish(page);
  await page.goto(`/?q=${encodeURIComponent(NAME)}`);
  const card = page.locator("article").filter({ hasText: NAME });
  await expect(card.getByRole("link", { name: NAME })).toBeVisible();
  await expect(card.locator("img")).toHaveAttribute(
    "src",
    /public\.blob\.vercel-storage\.com/,
  );
});

test("an invalid price keeps the editor open with the error on Price", async ({
  page,
}) => {
  await row(page, NAME)
    .getByRole("button", { name: `Edit ${NAME}` })
    .click();
  const dialog = page.getByRole("dialog", { name: "Edit product" });
  const price = dialog.getByLabel("Price");
  await price.fill("abc");
  await dialog.getByRole("button", { name: "Save changes" }).click();

  await expect(price).toHaveAttribute("aria-invalid", "true");
  await expect(price).toBeFocused();
  await expect(price).toHaveAccessibleDescription(
    "Enter a price of 0 or more, numbers only.",
  );
  await expect(dialog).toBeVisible();

  // Unsaved edits: closing asks first.
  await page.keyboard.press("Escape");
  const confirm = page.getByRole("dialog", {
    name: "Discard changes to this product?",
  });
  await confirm.getByRole("button", { name: "Discard changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/admin$/);
});

test("editing keeps the editor open on refresh and saves", async ({ page }) => {
  await row(page, NAME)
    .getByRole("button", { name: `Edit ${NAME}` })
    .click();
  await expect(page).toHaveURL(/\/admin\?edit=/);
  await page.reload();
  const dialog = page.getByRole("dialog", { name: "Edit product" });
  await expect(dialog.getByLabel("Product name")).toHaveValue(NAME);

  await dialog.getByLabel("Product name").fill(RENAMED);
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Discard changes to this product?" })
    .getByRole("button", { name: "Keep editing" })
    .click();
  await expect(dialog.getByLabel("Product name")).toHaveValue(RENAMED);
  await dialog.getByRole("button", { name: "Save changes" }).click();

  await expect(snackbar(page, `Saved ${RENAMED}.`)).toBeVisible();
  await expect(row(page, RENAMED)).toBeVisible();
});

test("deleting a product that's already gone says so and refreshes the list", async ({
  page,
  context,
}) => {
  await expect(row(page, RENAMED)).toBeVisible();

  // Someone else deletes it first, in another tab.
  const other = await context.newPage();
  await other.goto("/admin");
  await other.getByRole("button", { name: `Delete ${RENAMED}` }).click();
  await other
    .getByRole("dialog", { name: `Delete ${RENAMED}?` })
    .getByRole("button", { name: "Delete product" })
    .click();
  await expect(snackbar(other, `Deleted ${RENAMED}.`)).toBeVisible();
  await other.close();

  // This tab still lists it.
  await page.getByRole("button", { name: `Delete ${RENAMED}` }).click();
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(snackbar(page, "That product no longer exists.")).toBeVisible();
  await expect(row(page, RENAMED)).toHaveCount(0);
});

test("deleting removes the product from the list and the store", async ({
  page,
}) => {
  const name = `E2E delete ${RUN}`;
  await page.getByRole("link", { name: "Add product" }).click();
  const dialog = page.getByRole("dialog", { name: "Add product" });
  await dialog.getByLabel("Product name").fill(name);
  await dialog.getByLabel("Price").fill("10");
  await dialog.getByRole("button", { name: "Add product" }).click();
  await expect(row(page, name)).toBeVisible();
  await publish(page);

  await page.goto(`/?q=${encodeURIComponent(name)}`);
  await expect(
    page.getByRole("link", { name: new RegExp(name) }),
  ).toBeVisible();
  await page.goto("/admin");

  // No full reload: a marker on the window survives the delete.
  await page.evaluate(() => {
    (window as unknown as { marker: boolean }).marker = true;
  });
  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await page
    .getByRole("dialog", { name: `Delete ${name}?` })
    .getByRole("button", { name: "Delete product" })
    .click();
  await expect(snackbar(page, `Deleted ${name}.`)).toBeVisible();
  await expect(row(page, name)).toHaveCount(0);
  await publish(page);
  expect(
    await page.evaluate(
      () => (window as unknown as { marker?: boolean }).marker,
    ),
  ).toBe(true);

  await page.goto(`/?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(
    0,
  );
});

test("the upload route refuses a request without a session", async ({
  playwright,
  baseURL,
}) => {
  const anonymous = await playwright.request.newContext({ baseURL });
  const response = await anonymous.post("/api/blob/upload", {
    data: {
      type: "blob.generate-client-token",
      payload: {
        pathname: "products/x.webp",
        clientPayload: null,
        multipart: false,
      },
    },
  });
  expect(response.status()).toBe(401);
  await anonymous.dispose();
});
