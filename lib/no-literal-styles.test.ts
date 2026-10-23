import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// CLAUDE.md: colors, radii and type come from app/tokens.css and app/typography.css.
const ROOT = path.resolve(import.meta.dirname, "..");
const ALLOWED_HEX = new Set([path.join("app", "tokens.css")]);
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const SIZE_DECL = /\b(?:font-size|border-radius)\s*:\s*([^;}]+)/g;
// Values that come from tokens (or reset to nothing) are fine.
const isTokenValue = (value: string) =>
  /^(var\(|0$|inherit$|initial$)/.test(value.trim());

function sourceFiles(dir: string, pattern: RegExp): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(rel, pattern);
      return pattern.test(entry.name) ? [rel] : [];
    },
  );
}

function findAll(
  files: string[],
  regex: RegExp,
  keep: (match: RegExpMatchArray) => boolean = () => true,
): string[] {
  return files.flatMap((file) =>
    readFileSync(path.join(ROOT, file), "utf8")
      .split("\n")
      .flatMap((line, i) =>
        [...line.matchAll(regex)]
          .filter(keep)
          .map((m) => `${file}:${i + 1} ${m[0]}`),
      ),
  );
}

describe("literal style values", () => {
  it("hex colors appear only in app/tokens.css", () => {
    const files = ["app", "components"]
      .flatMap((dir) => sourceFiles(dir, /\.(css|tsx?)$/))
      .filter((file) => !ALLOWED_HEX.has(file));
    expect(findAll(files, HEX)).toEqual([]);
  });

  it("component CSS has no literal font sizes or radii", () => {
    const files = sourceFiles("components", /\.css$/);
    expect(findAll(files, SIZE_DECL, (m) => !isTokenValue(m[1] ?? ""))).toEqual(
      [],
    );
  });
});
