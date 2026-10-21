import { expect, test, type Page } from "@playwright/test";

// These read the seeded database. They run locally against the Neon dev branch and skip
// in CI until ticket 14 adds a test database.
test.skip(!process.env.DATABASE_URL, "Needs DATABASE_URL (a seeded database).");

const card = (page: Page, name: string) =>
  page.locator("#catalog").getByRole("link", { name, exact: true });
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const focusIsInDialog = (page: Page) =>
  page.evaluate(() => !!document.activeElement?.closest("dialog[open]"));

test.describe("product dialog", () => {
  test("a card opens the dialog over the grid, and Back closes it in place", async ({
    page,
  }) => {
    await page.goto("/");
    await card(page, "Power rack with J-hooks").scrollIntoViewIfNeeded();
    const before = await scrollY(page);
    expect(before).toBeGreaterThan(0);

    await card(page, "Power rack with J-hooks").click();
    const dialog = page.getByRole("dialog", {
      name: "Power rack with J-hooks",
    });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/products\/power-rack-with-j-hooks$/);
    await expect(dialog.getByText("Gym equipment")).toBeVisible();
    await expect(dialog.getByText("₱24,900")).toBeVisible();
    await expect(
      dialog.getByText("To order or ask about this item"),
    ).toBeVisible();
    expect(await scrollY(page)).toBe(before);

    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    expect(await scrollY(page)).toBe(before);
    await expect(card(page, "Power rack with J-hooks")).toBeVisible();
  });

  test("traps focus, closes on Escape and returns focus to the card", async ({
    page,
  }) => {
    await page.goto("/");
    await card(page, "Ergonomic mesh chair").focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Ergonomic mesh chair" });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Close" });
    await expect(close).toBeFocused();

    // Close, phone, copy phone, email, copy email, then back round to Close.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      expect(await focusIsInDialog(page)).toBe(true);
    }
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "Copy email" }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    await expect(card(page, "Ergonomic mesh chair")).toBeFocused();
  });

  test("the close button closes it and returns focus to the card", async ({
    page,
  }) => {
    await page.goto("/");
    await card(page, "Dual monitor arm").click();
    const dialog = page.getByRole("dialog", { name: "Dual monitor arm" });
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    await expect(card(page, "Dual monitor arm")).toBeFocused();
  });

  // Next.js shows the same hidden dialog instance again when a product is reopened.
  // Its close guard used to stay set from the first close, so the second close did nothing.
  test("the same product opens and closes again and again", async ({
    page,
  }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Dual monitor arm" });
    const closes = [
      () => dialog.getByRole("button", { name: "Close" }).click(),
      () => page.keyboard.press("Escape"),
      () => page.goBack(),
      () => dialog.getByRole("button", { name: "Close" }).click(),
    ];
    for (const close of closes) {
      await card(page, "Dual monitor arm").click();
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(/\/products\/dual-monitor-arm$/);
      // People read the details before closing.
      await page.waitForTimeout(1500);
      await close();
      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(/\/$/);
      await expect(card(page, "Dual monitor arm")).toBeFocused();
    }
  });

  // Chrome closes the <dialog> itself on a second Escape if the page prevented the first
  // without a click in between. The route must follow, or the card can't reopen it.
  test("a fast double Escape closes it and the product reopens", async ({
    page,
  }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Dual monitor arm" });
    for (let i = 0; i < 2; i++) {
      await card(page, "Dual monitor arm").click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test("keeps the catalog filter behind the dialog", async ({ page }) => {
    await page.goto("/?category=gym");
    await card(page, "Adjustable FID bench").click();
    await expect(
      page.getByRole("dialog", { name: "Adjustable FID bench" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/\?category=gym$/);
    await expect(page.getByText("4 of 8 shown")).toBeVisible();
  });

  // The card is clicked before the 250ms search debounce fires (or before the filtered
  // results arrive). The search is applied first, so closing goes back to it.
  test("a card clicked right after typing a search closes back to the search", async ({
    page,
  }) => {
    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "Search products" });
    await search.fill("bench");
    await card(page, "Adjustable FID bench").click();

    const dialog = page.getByRole("dialog", { name: "Adjustable FID bench" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/products\/adjustable-fid-bench$/);
    // Past the debounce: the URL must still be the product's.
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/\/products\/adjustable-fid-bench$/);

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/\?q=bench$/);
    await expect(page.getByText("1 of 8 shown")).toBeVisible();
    await expect(search).toHaveValue("bench");
    await expect(card(page, "Adjustable FID bench")).toBeFocused();
  });

  test("a card clicked while a category is loading closes back to that category", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("group", { name: "Filter by category" })
      .getByRole("button", { name: "Gym equipment", exact: true })
      .click();
    await card(page, "Olympic barbell 20 kg").click();

    const dialog = page.getByRole("dialog", { name: "Olympic barbell 20 kg" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/\?category=gym$/);
    await expect(page.getByText("4 of 8 shown")).toBeVisible();
  });

  test("a modified click on a card still opens a new tab", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page
      .getByRole("searchbox", { name: "Search products" })
      .fill("bench");
    const [tab] = await Promise.all([
      context.waitForEvent("page"),
      card(page, "Adjustable FID bench").click({
        modifiers: ["ControlOrMeta"],
      }),
    ]);
    await tab.waitForURL(/\/products\/adjustable-fid-bench$/);
    await expect(tab.getByRole("heading", { level: 1 })).toHaveText(
      "Adjustable FID bench",
    );
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$|\/\?q=bench$/);
  });

  test("an out-of-stock product still opens and shows its status", async ({
    page,
  }) => {
    await page.goto("/");
    await card(page, "Rubber hex dumbbells, pair").click();
    const dialog = page.getByRole("dialog", {
      name: "Rubber hex dumbbells, pair",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Out of stock")).toBeVisible();
  });

  test("copying the phone number shows a snackbar over the dialog", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await card(page, "Ergonomic mesh chair").click();
    const dialog = page.getByRole("dialog", { name: "Ergonomic mesh chair" });
    await dialog.getByRole("button", { name: "Copy phone" }).click();
    const status = dialog.getByRole("status");
    await expect(status).toContainText("Copied ");
    await expect(status.getByText(/^Copied /)).toBeVisible();
  });
});

test.describe("product page", () => {
  test("a direct visit shows the full page, not the dialog", async ({
    page,
  }) => {
    const response = await page.goto("/products/ergonomic-mesh-chair");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Ergonomic mesh chair | KK Trading");
    await expect(
      page.getByRole("heading", { level: 1, name: "Ergonomic mesh chair" }),
    ).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Back to all products" }),
    ).toHaveAttribute("href", "/#catalog");
    await expect(
      page.getByRole("link", { name: "0917 000 0000" }),
    ).toBeVisible();
  });

  test("the back link goes to the catalog", async ({ page }) => {
    await page.goto("/products/ergonomic-mesh-chair");
    await page.getByRole("link", { name: "Back to all products" }).click();
    await expect(page).toHaveURL(/\/#catalog$/);
    await expect(
      page.getByRole("heading", { name: "Products", level: 2 }),
    ).toBeInViewport();
  });

  test("an unknown or malformed slug is a 404", async ({ page }) => {
    for (const path of [
      "/products/no-such-product",
      "/products/Not%20A%20Slug",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(
        page.getByRole("heading", { level: 1, name: "Page not found" }),
      ).toBeVisible();
    }
  });

  test("no horizontal scroll from 320 to 1920 wide", async ({ page }) => {
    for (const width of [320, 390, 640, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/products/rubber-hex-dumbbells-pair");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("product links without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a card loads the product page", async ({ page }) => {
    await page.goto("/");
    await card(page, "Olympic barbell 20 kg").click();
    await expect(page).toHaveURL(/\/products\/olympic-barbell-20-kg$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Olympic barbell 20 kg" }),
    ).toBeVisible();
  });
});
