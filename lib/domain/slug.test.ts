import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it.each([
    ["Ergonomic mesh chair", "ergonomic-mesh-chair"],
    ["Olympic barbell 20 kg", "olympic-barbell-20-kg"],
    ["Rubber hex dumbbells, pair", "rubber-hex-dumbbells-pair"],
    ["Power rack with J-hooks", "power-rack-with-j-hooks"],
    ["Café table × 2", "cafe-table-2"],
    ["  --Desk!!  ", "desk"],
  ])("turns %j into %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("₱ · ×", "product")).toBe("product");
  });
});

describe("uniqueSlug", () => {
  it("keeps the base when it's free", () => {
    expect(uniqueSlug("desk", ["desk-lamp"])).toBe("desk");
  });

  it("adds -2, then -3, on collisions", () => {
    expect(uniqueSlug("desk", ["desk"])).toBe("desk-2");
    expect(uniqueSlug("desk", ["desk", "desk-2"])).toBe("desk-3");
  });
});
