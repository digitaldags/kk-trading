import { expect, test } from "@playwright/test";

test.describe("UI primitives on /styleguide", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/styleguide");
  });

  test("dialog traps focus, closes on Escape and returns focus", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: "Open edit dialog" });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Edit product" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "Product name" }),
    ).toBeFocused();

    // Tab through more stops than the dialog has; focus must never leave it.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((el) =>
        el.contains(document.activeElement),
      );
      expect(inside).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("delete dialog closes on a scrim click", async ({ page }) => {
    await page.getByRole("button", { name: "Open delete dialog" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Delete Ergonomic mesh chair?",
    });
    await expect(dialog).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(dialog).toBeHidden();
  });

  test("filter chips toggle with the keyboard", async ({ page }) => {
    const chips = page.getByTestId("chips");
    const gym = chips.getByRole("button", { name: "Gym equipment" });
    await gym.focus();
    await page.keyboard.press("Space");
    await expect(gym).toHaveAttribute("aria-pressed", "true");
    await expect(chips.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("segmented buttons select with the keyboard", async ({ page }) => {
    const group = page.getByTestId("segmented");
    const low = group.getByRole("button", { name: "Low stock" });
    await low.focus();
    await page.keyboard.press("Enter");
    await expect(low).toHaveAttribute("aria-pressed", "true");
    await expect(
      group.getByRole("button", { name: "In stock" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("snackbar announces a message", async ({ page }) => {
    await page.getByRole("button", { name: "Show snackbar" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved Ergonomic mesh chair.",
    );
  });
});
