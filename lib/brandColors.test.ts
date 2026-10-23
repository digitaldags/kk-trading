import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_COLOR_TOKENS, BRAND_COLORS } from "./brandColors";

const tokens = readFileSync(
  path.resolve(import.meta.dirname, "../app/tokens.css"),
  "utf8",
);

describe("BRAND_COLORS", () => {
  it.each(Object.entries(BRAND_COLOR_TOKENS))(
    "%s matches %s in app/tokens.css",
    (key, token) => {
      const match = tokens.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]+);`));
      expect(match?.[1]?.toLowerCase()).toBe(
        BRAND_COLORS[key as keyof typeof BRAND_COLORS],
      );
    },
  );
});
