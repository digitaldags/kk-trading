import { writeFileSync } from "node:fs";
import { ICON_FONT_CSS_URL, ICON_NAMES } from "@/lib/iconNames";

// Downloads Material Symbols Rounded, subset to ICON_NAMES, into app/fonts/.
// Run after adding an icon to lib/iconNames.ts. The font is Apache 2.0 (Google).
const OUT = "app/fonts/material-symbols-rounded";
// Google serves woff2 only to browsers it recognises.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

async function main() {
  const css = await (
    await fetch(ICON_FONT_CSS_URL, { headers: { "User-Agent": BROWSER_UA } })
  ).text();
  const fontUrl = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(
    css,
  )?.[1];
  if (!fontUrl)
    throw new Error(`No font URL in the Google Fonts response:\n${css}`);

  const font = Buffer.from(await (await fetch(fontUrl)).arrayBuffer());
  writeFileSync(`${OUT}.woff2`, font);
  writeFileSync(
    `${OUT}.json`,
    `${JSON.stringify({ iconNames: ICON_NAMES }, null, 2)}\n`,
  );
  console.log(
    `Saved ${ICON_NAMES.length} icons (${Math.round(font.length / 1024)} KiB) to ${OUT}.woff2`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
