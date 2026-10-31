import { execFileSync } from "node:child_process";
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

/** Runs a script under scripts/ with tsx, as the admin specs do, and returns its output. */
export function runScript(script: string, ...args: string[]): string {
  return execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", script, ...args],
    { encoding: "utf8" },
  );
}

/** What scripts/e2e-seed-documents.ts made (tickets 23 and 24). */
export type SeededDocuments = {
  completed: { id: string; number: string };
  draft: { id: string; number: string };
  receipt: { id: string; number: string; code: string };
  grandTotal: string;
};

/** A completed quotation with one receipt, and a draft, all numbered "E2E-…". */
export function seedDocuments(): SeededDocuments {
  // The seed prints its JSON on the last line.
  return JSON.parse(
    runScript("scripts/e2e-seed-documents.ts").trim().split("\n").at(-1)!,
  ) as SeededDocuments;
}

/** Deletes every "E2E-…" quotation and its receipts (scripts/e2e-cleanup.ts --documents). */
export function cleanUpE2eDocuments() {
  runScript("scripts/e2e-cleanup.ts", "--documents");
}
