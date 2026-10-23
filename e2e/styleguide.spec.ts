import { expect, test } from "@playwright/test";

test("icon font loads so ligatures render as glyphs", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByTestId("icons")).toBeVisible();

  const loaded = await page.evaluate(async () => {
    await document.fonts.load('24px "Material Symbols Rounded"', "chair");
    await document.fonts.ready;
    return document.fonts.check('24px "Material Symbols Rounded"', "chair");
  });
  expect(loaded).toBe(true);
});
