import { expect, type Page } from "@playwright/test";

// Shared by the admin specs.

/**
 * A product code for an e2e product (ticket 17): its name in capitals with dashes, so it's
 * unique because the name carries the run's timestamp. Capped at the 40-character limit.
 */
export function codeFor(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-40);
}

/**
 * Publishes the draft from the Publish bar (ticket 15), so `/` shows it. Admin saves only
 * change the draft. Must be on an admin page with unpublished changes.
 */
export async function publish(page: Page) {
  await page
    .getByRole("region", { name: "Unpublished changes" })
    .getByRole("button", { name: "Publish" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Your changes are live." }),
  ).toBeVisible();
  await expect(page.getByText("All changes live")).toBeVisible();
}
