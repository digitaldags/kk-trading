import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { publish } from "./helpers";

// The core flows from ticket 14, run twice: at 1440×900 (flows-desktop) and 390×844
// (flows-mobile), see playwright.config.ts. They run after every other spec, one at a
// time, because they publish. Each flow uses its own "E2E flow …" names and cleans up.
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
test.skip(
  !process.env.DATABASE_URL || !EMAIL || !PASSWORD,
  "Needs DATABASE_URL and the E2E_ADMIN_* test account.",
);

test.describe.configure({ mode: "serial" });

const RUN = `${Date.now()}`;

function runScript(script: string) {
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", `scripts/${script}`],
    { stdio: "ignore" },
  );
}

test.beforeAll(() => {
  if (!process.env.DATABASE_URL || !EMAIL || !PASSWORD) return;
  runScript("e2e-cleanup.ts");
  runScript("e2e-reset-login-attempts.ts");
});

test.afterAll(() => {
  if (!process.env.DATABASE_URL || !EMAIL || !PASSWORD) return;
  // Flow 3 fails a sign-in on purpose; don't let repeated runs lock the account.
  runScript("e2e-reset-login-attempts.ts");
});

const card = (page: Page, name: string) =>
  page.locator("#catalog").getByRole("link", { name, exact: true });
const cardNames = (page: Page) =>
  page.locator("#catalog ul").first().getByRole("heading", { level: 3 });
const chip = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Filter by category" })
    .getByRole("button", { name, exact: true });
const snackbar = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });
const productRow = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Products" })
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });

async function signIn(page: Page, next = "/admin") {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`));
}

/** A small PNG drawn by the browser, for the photo upload. */
async function pngFile(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 30;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "coral";
    context.fillRect(0, 0, 40, 30);
    return canvas.toDataURL("image/png");
  });
  return {
    name: "flow.png",
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.split(",")[1]!, "base64"),
  };
}

async function addProduct(
  page: Page,
  { name, price, category }: { name: string; price: string; category?: string },
) {
  await page.goto("/admin?new=1");
  const dialog = page.getByRole("dialog", { name: "Add product" });
  await dialog.getByLabel("Product name").fill(name);
  if (category)
    await dialog.getByLabel("Category").selectOption({ label: category });
  await dialog.getByLabel("Price").fill(price);
  return dialog;
}

async function addCategory(page: Page, name: string) {
  await page.goto("/admin/categories?new=1");
  const dialog = page.getByRole("dialog", { name: "Add category" });
  await dialog.getByLabel("Category name").fill(name);
  await dialog.getByRole("button", { name: "Add category" }).click();
  await expect(snackbar(page, `Added ${name}.`)).toBeVisible();
}

test("1. storefront: filter Gym, search bench, open the dialog, close with Escape", async ({
  page,
}) => {
  await page.goto("/");
  await chip(page, "Gym equipment").click();
  await expect(page).toHaveURL(/\?category=gym/);
  await page.getByRole("searchbox", { name: "Search products" }).fill("bench");
  await expect(page).toHaveURL(/category=gym&q=bench/);
  await expect(cardNames(page)).toHaveText(["Adjustable FID bench"]);

  await card(page, "Adjustable FID bench").click();
  const dialog = page.getByRole("dialog", { name: "Adjustable FID bench" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/category=gym&q=bench/);
});

test("2. a direct visit to a product renders the full page", async ({
  page,
}) => {
  await page.goto("/products/olympic-barbell-20-kg");
  await expect(
    page.getByRole("heading", { level: 1, name: "Olympic barbell 20 kg" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Back to all products" }),
  ).toBeVisible();
});

test("3. a wrong password fails, then the right one signs in", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(`${PASSWORD}-wrong`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("That email and password don't match."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("4. add a product with a photo, see it on the store, change its price, delete it", async ({
  page,
}) => {
  const name = `E2E flow product ${RUN}`;
  const withPhoto = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  await signIn(page);

  const dialog = await addProduct(page, { name, price: "1,500" });
  if (withPhoto) {
    await dialog
      .locator('input[type="file"]')
      .setInputFiles(await pngFile(page));
    await expect(
      dialog.getByRole("img", { name: "Product photo" }),
    ).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Add product" }).click();
  await expect(snackbar(page, `Added ${name}.`)).toBeVisible();
  await publish(page);

  await page.goto(`/?q=${encodeURIComponent(name)}`);
  const article = page.locator("article").filter({ hasText: name });
  await expect(article).toContainText("₱1,500");
  if (withPhoto) {
    await expect(article.locator("img")).toHaveAttribute(
      "src",
      /public\.blob\.vercel-storage\.com/,
    );
  }

  await page.goto("/admin");
  await productRow(page, name)
    .getByRole("button", { name: `Edit ${name}` })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit product" });
  await editor.getByLabel("Price").fill("2,250");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(snackbar(page, `Saved ${name}.`)).toBeVisible();
  await publish(page);
  await page.goto(`/?q=${encodeURIComponent(name)}`);
  await expect(page.locator("article").filter({ hasText: name })).toContainText(
    "₱2,250",
  );

  await page.goto("/admin");
  await productRow(page, name)
    .getByRole("button", { name: `Delete ${name}` })
    .click();
  await page
    .getByRole("dialog", { name: `Delete ${name}?` })
    .getByRole("button", { name: "Delete product" })
    .click();
  await expect(snackbar(page, `Deleted ${name}.`)).toBeVisible();
  await publish(page);
  await page.goto(`/?q=${encodeURIComponent(name)}`);
  await expect(card(page, name)).toHaveCount(0);
});

test("5. move products into a new category by deleting the old one", async ({
  page,
}) => {
  const oldCategory = `E2E flow old ${RUN}`;
  const newCategory = `E2E flow new ${RUN}`;
  const item = `E2E flow item ${RUN}`;
  await signIn(page);

  // The old category, with one product in it, live on the store.
  await addCategory(page, oldCategory);
  const dialog = await addProduct(page, {
    name: item,
    price: "100",
    category: oldCategory,
  });
  await dialog.getByRole("button", { name: "Add product" }).click();
  await expect(snackbar(page, `Added ${item}.`)).toBeVisible();
  await addCategory(page, newCategory);
  await publish(page);

  // Delete the old one, moving its product to the new one.
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: `Delete ${oldCategory}` }).click();
  const confirm = page.getByRole("dialog", { name: `Delete ${oldCategory}?` });
  await expect(confirm).toContainText(`${oldCategory} has 1 product.`);
  await confirm
    .getByLabel("Move products to")
    .selectOption({ label: newCategory });
  await confirm.getByRole("button", { name: "Delete category" }).click();
  await expect(
    snackbar(
      page,
      `Deleted ${oldCategory}. Its 1 product moved to ${newCategory}.`,
    ),
  ).toBeVisible();
  await publish(page);

  await page.goto("/");
  await expect(chip(page, oldCategory)).toHaveCount(0);
  await chip(page, newCategory).click();
  await expect(cardNames(page)).toHaveText([item]);

  // Clean up: the product, then its category.
  await page.goto("/admin");
  await productRow(page, item)
    .getByRole("button", { name: `Delete ${item}` })
    .click();
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(snackbar(page, `Deleted ${item}.`)).toBeVisible();
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: `Delete ${newCategory}` }).click();
  await page.getByRole("button", { name: "Delete category" }).click();
  await expect(snackbar(page, `Deleted ${newCategory}.`)).toBeVisible();
  await publish(page);
});

test("6. a new store name shows in the storefront title", async ({ page }) => {
  await signIn(page, "/admin/settings");
  const field = page.getByLabel("Store name");
  const original = await field.inputValue();
  const renamed = `${original} E2E`;

  const save = async (name: string) => {
    await page.goto("/admin/settings");
    await page.getByLabel("Store name").fill(name);
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(snackbar(page, "Store details saved.")).toBeVisible();
    await publish(page);
  };

  await save(renamed);
  await page.goto("/");
  await expect(page).toHaveTitle(renamed);

  await save(original);
  await page.goto("/");
  await expect(page).toHaveTitle(original);
});

test("7. signing out, /admin goes to the sign-in page", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
});
