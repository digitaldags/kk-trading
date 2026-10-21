import { expect, test, type Page } from "@playwright/test";

// These read the seeded database (2 categories, 8 products). They run locally against
// the Neon dev branch and skip in CI until ticket 14 adds a test database.
test.skip(!process.env.DATABASE_URL, "Needs DATABASE_URL (a seeded database).");

const grid = (page: Page) => page.locator("#catalog ul").first();
const cardNames = (page: Page) => grid(page).getByRole("heading", { level: 3 });
const chip = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Filter by category" })
    .getByRole("button", { name, exact: true });

test.describe("storefront", () => {
  test("renders the page from the database", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("8 of 8 shown")).toBeVisible();
  });

  test("server-renders the category filter from the URL", async ({ page }) => {
    await page.goto("/?category=office");
    await expect(chip(page, "Office equipment")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(cardNames(page)).toHaveCount(4);
    await expect(grid(page)).not.toContainText("Gym equipment");
    await expect(page.getByText("4 of 8 shown")).toBeVisible();
  });

  test("search matches spec and description, ignoring case", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("searchbox", { name: "Search products" })
      .fill("BENCH");
    await expect(page).toHaveURL(/\?q=BENCH$/);
    await expect(cardNames(page)).toHaveText(["Adjustable FID bench"]);

    // "central lock" is only in the filing cabinet's key spec.
    await page.goto("/?q=central%20LOCK");
    await expect(cardNames(page)).toHaveText(["Steel 4-drawer filing cabinet"]);
    // "sold as a pair" is only in the dumbbells' description.
    await page.goto("/?q=sold%20as");
    await expect(cardNames(page)).toHaveText(["Rubber hex dumbbells, pair"]);
  });

  test("a chip filters in place without scrolling", async ({ page }) => {
    await page.goto("/");
    await chip(page, "Gym equipment").scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);

    await chip(page, "Gym equipment").click();
    await expect(page).toHaveURL(/\?category=gym$/);
    await expect(cardNames(page)).toHaveCount(4);
    await expect(chip(page, "Gym equipment")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(before);

    await chip(page, "All").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(cardNames(page)).toHaveCount(8);
  });

  test("the filter survives leaving the page and coming back", async ({
    page,
  }) => {
    await page.goto("/?category=gym&q=bench");
    await page.goto("/styleguide");
    await page.goBack();
    await expect(chip(page, "Gym equipment")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("searchbox", { name: "Search products" }),
    ).toHaveValue("bench");
    await expect(cardNames(page)).toHaveText(["Adjustable FID bench"]);
  });

  test("a category tile filters and jumps to the catalog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^Gym equipment.*items/ }).click();
    await expect(page).toHaveURL(/\?category=gym#catalog$/);
    await expect(cardNames(page)).toHaveCount(4);
    await expect(
      page.getByRole("heading", { name: "Products", level: 2 }),
    ).toBeInViewport();
  });

  test("copying the phone number shows a snackbar", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await page.getByRole("button", { name: "Copy phone" }).click();
    await expect(page.getByRole("status")).toContainText("Copied ");
  });

  test("no horizontal scroll from 320 to 1920 wide", async ({ page }) => {
    for (const width of [320, 390, 640, 768, 860, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("storefront without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("filters and search work as plain links and forms", async ({ page }) => {
    await page.goto("/?category=gym&q=bench");
    await expect(chip(page, "Gym equipment")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(cardNames(page)).toHaveText(["Adjustable FID bench"]);

    await chip(page, "Office equipment").click();
    await expect(page).toHaveURL(/category=office/);
    await expect(page).toHaveURL(/q=bench/);
    await expect(page.getByText("No products match")).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Search products" });
    await search.fill("chair");
    await search.press("Enter");
    await expect(page).toHaveURL(/category=office&q=chair/);
    await expect(cardNames(page)).toHaveText(["Ergonomic mesh chair"]);
  });
});
