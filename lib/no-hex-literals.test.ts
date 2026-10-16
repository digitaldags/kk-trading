import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// CLAUDE.md: colors come from app/tokens.css; never hardcode a hex value elsewhere.
const ROOT = path.resolve(import.meta.dirname, "..");
const SCAN_DIRS = ["app", "components"];
const ALLOWED = new Set([path.join("app", "tokens.css")]);
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(rel);
      return /\.(css|tsx?)$/.test(entry.name) && !ALLOWED.has(rel) ? [rel] : [];
    },
  );
}

describe("hex color literals", () => {
  it("appear only in app/tokens.css", () => {
    const hits = SCAN_DIRS.flatMap(sourceFiles).flatMap((file) =>
      readFileSync(path.join(ROOT, file), "utf8")
        .split("\n")
        .flatMap((line, i) =>
          (line.match(HEX) ?? []).map((hex) => `${file}:${i + 1} ${hex}`),
        ),
    );
    expect(hits).toEqual([]);
  });
});
