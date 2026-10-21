import { describe, expect, it } from "vitest";
import { productsUrl } from "./adminUrl";

describe("productsUrl", () => {
  it("leaves out empty values", () => {
    expect(productsUrl()).toBe("/admin");
    expect(productsUrl({ q: "  " })).toBe("/admin");
  });

  it("keeps the search with the editor", () => {
    expect(productsUrl({ q: " desk lamp ", isNew: true })).toBe(
      "/admin?q=desk+lamp&new=1",
    );
    expect(productsUrl({ q: "chair", edit: "abc" })).toBe(
      "/admin?q=chair&edit=abc",
    );
  });
});
