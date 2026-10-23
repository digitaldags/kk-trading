import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// Categories admin against the Neon dev branch. Each run adds its own category (named
// with a timestamp), never gives it products, and deletes it again, so the seeded
// categories are only reordered and put back. Skips in CI until ticket 14 adds a test
// database.
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
test.skip(
  !process.env.DATABASE_URL || !EMAIL || !PASSWORD,
  "Needs DATABASE_URL and the E2E_ADMIN_* test account.",
);

// The tests build on each other: add, check the store, reorder, then delete.
test.describe.configure({ mode: "serial" });

const NAME = `E2E category ${Date.now()}`;

async function signIn(page: Page) {
  await page.goto("/admin/login?next=%2Fadmin%2Fcategories");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
}

const snackbar = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

const rowNames = (page: Page) =>
  page
    .getByRole("list", { name: "Categories" })
    .getByRole("listitem")
    .locator("span.t-body-large");

// Clear categories an interrupted run left behind, so the storefront shows the seed's.
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

test("adding a category by keyboard alone shows it on the store", async ({
  page,
}) => {
  await expect(page).toHaveTitle("Categories · Admin");
  await expect(
    page.getByRole("link", { name: "Categories", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Add category" }).click();
  const dialog = page.getByRole("dialog", { name: "Add category" });
  const name = dialog.getByLabel("Category name");
  await expect(name).toBeFocused();
  await page.keyboard.type(NAME);
  await page.keyboard.press("Tab");
  await page.keyboard.type("Made by the e2e tests");

  // Tab lands on the selected icon ("category"); the arrow keys move the selection.
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("radio", { name: "category" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  const tennis = dialog.getByRole("radio", { name: "sports tennis" });
  await expect(tennis).toBeFocused();
  await expect(tennis).toBeChecked();

  // On to Cancel, then Add category.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Add category" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(snackbar(page, `Added ${NAME}.`)).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(rowNames(page).last()).toHaveText(NAME);

  // On the store: a tile, a chip and a nav link.
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: new RegExp(`^${NAME}`) }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Filter by category" })
      .getByRole("button", { name: NAME, exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: NAME, exact: true }),
  ).toBeVisible();
  // The tile shows the picked icon.
  await expect(
    page.locator("a").filter({ hasText: NAME }).filter({ hasText: "0 items" }),
  ).toContainText("sports_tennis");
});

test("a name another category has, in any case, is refused", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Add category" }).click();
  const dialog = page.getByRole("dialog", { name: "Add category" });
  const name = dialog.getByLabel("Category name");
  await name.fill("GYM EQUIPMENT");
  await dialog.getByRole("button", { name: "Add category" }).click();
  await expect(name).toHaveAccessibleDescription(
    "A category with this name already exists.",
  );
  await expect(name).toBeFocused();

  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Discard changes to this category?" })
    .getByRole("button", { name: "Discard changes" })
    .click();
  await expect(dialog).toBeHidden();
});

test("moving a category changes the order, here and on the store", async ({
  page,
}) => {
  await expect(rowNames(page).last()).toHaveText(NAME);
  await page.getByRole("button", { name: `Move ${NAME} up` }).click();
  await expect(rowNames(page)).toHaveText([
    "Office equipment",
    NAME,
    "Gym equipment",
  ]);
  // Focus stays with the row that moved.
  await expect(
    page.getByRole("button", { name: `Move ${NAME} up` }),
  ).toBeFocused();

  await page.goto("/");
  await expect(
    page.getByRole("group", { name: "Filter by category" }).getByRole("button"),
    // The selected chip ("All") also shows its check icon.
  ).toHaveText([/All$/, "Office equipment", NAME, "Gym equipment"]);

  // Put it back at the end, so the seed's order is unchanged.
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: `Move ${NAME} down` }).click();
  await expect(rowNames(page)).toHaveText([
    "Office equipment",
    "Gym equipment",
    NAME,
  ]);
});

test("deleting a category without products removes it from the store", async ({
  page,
}) => {
  await page.getByRole("button", { name: `Delete ${NAME}` }).click();
  const dialog = page.getByRole("dialog", { name: `Delete ${NAME}?` });
  await expect(dialog).toContainText(
    `${NAME} has no products. It will be removed from the store.`,
  );
  await dialog.getByRole("button", { name: "Delete category" }).click();
  await expect(snackbar(page, `Deleted ${NAME}.`)).toBeVisible();
  await expect(rowNames(page)).toHaveText([
    "Office equipment",
    "Gym equipment",
  ]);

  await page.goto("/");
  await expect(
    page
      .getByRole("group", { name: "Filter by category" })
      .getByRole("button", { name: NAME }),
  ).toHaveCount(0);
});

test("deleting a category with products asks where to move them", async ({
  page,
}) => {
  // Only opens the dialog: the seed's categories stay.
  await page.getByRole("button", { name: "Delete Gym equipment" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete Gym equipment?" });
  await expect(dialog).toContainText(
    "Gym equipment has 4 products. Choose where to move them.",
  );
  await expect(dialog.getByLabel("Move products to")).toHaveValue(
    /[0-9a-f-]{36}/,
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});
