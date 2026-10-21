import { describe, expect, it } from "vitest";
import { buildCatalogUrl, categoryHref, countLabel } from "./catalogUrl";

describe("buildCatalogUrl", () => {
  it("leaves out empty values", () => {
    expect(buildCatalogUrl({})).toBe("/");
    expect(buildCatalogUrl({ category: "", q: "   " })).toBe("/");
    expect(buildCatalogUrl({ category: null, q: null })).toBe("/");
  });

  it("keeps category before q and trims the search", () => {
    expect(buildCatalogUrl({ category: "gym", q: " bench " })).toBe(
      "/?category=gym&q=bench",
    );
  });

  it("encodes the search text", () => {
    expect(buildCatalogUrl({ q: "2 × 10 kg & more" })).toBe(
      "/?q=2+%C3%97+10+kg+%26+more",
    );
  });
});

describe("categoryHref", () => {
  it("filters and jumps to the catalog", () => {
    expect(categoryHref("office")).toBe("/?category=office#catalog");
  });
});

describe("countLabel", () => {
  it("uses the singular for one", () => {
    expect(countLabel(1, "item", "items")).toBe("1 item");
    expect(countLabel(0, "item", "items")).toBe("0 items");
    expect(countLabel(4, "item", "items")).toBe("4 items");
  });
});
