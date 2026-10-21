import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BANNER_ICONS } from "@/components/ui/Banner/Banner";
import { STOCK_ICONS } from "@/components/ui/StockStatus/StockStatus";
import { CATEGORY_ICONS } from "@/lib/domain/icons";
import fontManifest from "@/app/fonts/material-symbols-rounded.json";
import { ICON_FONT_CSS_URL, ICON_NAMES } from "./iconNames";

// The icon font only contains ICON_NAMES. Anything else shows as its name in text.
const ROOT = path.resolve(import.meta.dirname, "..");
// `<Icon name="x"`, `icon="x"` (Button, IconButton) and `icon: "x"` (data).
const ICON_LITERAL = /(?:<Icon\s+name|\bicon)\s*[=:]\s*["']([a-z0-9_]+)["']/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(rel);
      return /\.tsx$/.test(entry.name) && !entry.name.includes(".test.")
        ? [rel]
        : [];
    },
  );
}

describe("icon font subset", () => {
  it("includes every icon literal used in app/ and components/", () => {
    const used = ["app", "components"]
      .flatMap(sourceFiles)
      .flatMap((file) =>
        [
          ...readFileSync(path.join(ROOT, file), "utf8").matchAll(ICON_LITERAL),
        ].map((m) => ({ file, icon: m[1] ?? "" })),
      );
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter(({ icon }) => !ICON_NAMES.includes(icon))).toEqual([]);
  });

  it("includes the category, stock status and banner icons", () => {
    const required = [
      ...CATEGORY_ICONS,
      ...Object.values(STOCK_ICONS),
      ...Object.values(BANNER_ICONS),
    ];
    expect(required.filter((icon) => !ICON_NAMES.includes(icon))).toEqual([]);
  });

  it("is sorted and unique, as Google Fonts requires", () => {
    expect([...ICON_NAMES]).toEqual([...new Set(ICON_NAMES)].sort());
    expect(ICON_FONT_CSS_URL).toContain(`icon_names=${ICON_NAMES.join(",")}`);
  });

  it("matches the downloaded font (run `pnpm icons:fetch` after changing the list)", () => {
    expect(fontManifest.iconNames).toEqual(ICON_NAMES);
  });
});
