import { writeFileSync } from "node:fs";

// Downloads Roboto (weights 400 to 500, one variable file) into app/fonts/, subset to the
// characters the store uses: Latin-1, general punctuation and the peso sign. Self-hosted
// because next/font/google fails the build when Google serves Roboto from a
// `/l/font?kit=…&skey=…` URL (Turbopack can't parse the extra query entries).
// The font is OFL 1.1 (Google).
const OUT = "app/fonts/roboto.woff2";
// Google serves woff2 only to browsers it recognises.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

function range(from: number, to: number): string {
  let text = "";
  for (let c = from; c <= to; c++) text += String.fromCharCode(c);
  return text;
}

// Basic Latin, Latin-1, dashes / quotes / bullet / ellipsis, then ₱ € ™ − ← →.
const TEXT =
  range(0x20, 0x7e) + range(0xa0, 0xff) + range(0x2010, 0x2027) + "₱€™−←→";

const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Roboto:wght@400..500&display=swap" +
  `&text=${encodeURIComponent(TEXT)}`;

async function main() {
  const css = await (
    await fetch(CSS_URL, { headers: { "User-Agent": BROWSER_UA } })
  ).text();
  const fontUrl = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(
    css,
  )?.[1];
  if (!fontUrl)
    throw new Error(`No font URL in the Google Fonts response:\n${css}`);

  const font = Buffer.from(await (await fetch(fontUrl)).arrayBuffer());
  writeFileSync(OUT, font);
  console.log(`Saved Roboto (${Math.round(font.length / 1024)} KiB) to ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
