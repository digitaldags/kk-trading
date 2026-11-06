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

/** A PNG drawn by the browser, for the photo and logo uploads. */
export async function pngFile(
  page: Page,
  { width = 40, height = 30, name = "photo.png", color = "teal" } = {},
) {
  const dataUrl = await page.evaluate(
    ({ width, height, color }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL("image/png");
    },
    { width, height, color },
  );
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.split(",")[1]!, "base64"),
  };
}

/**
 * A PNG that stops early, like the file in BUG-02. The picture is noise, so its bytes are
 * spread evenly over its rows and `keep` is roughly the share of rows that survive.
 */
export async function truncatedPngFile(
  page: Page,
  { keep, name = "cut-off.png" }: { keep: number; name?: string },
) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 400;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(200, 400);
    for (let i = 0; i < pixels.data.length; i++) {
      pixels.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png");
  });
  const buffer = Buffer.from(dataUrl.split(",")[1]!, "base64");
  return {
    name,
    mimeType: "image/png",
    buffer: buffer.subarray(0, Math.floor(buffer.length * keep)),
  };
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
