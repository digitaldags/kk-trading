import { describe, expect, it } from "vitest";
import { safeAdminPath } from "./safeNext";

describe("safeAdminPath", () => {
  it("keeps admin paths with their query", () => {
    expect(safeAdminPath("/admin")).toBe("/admin");
    expect(safeAdminPath("/admin/products?q=chair")).toBe(
      "/admin/products?q=chair",
    );
  });

  it("falls back to /admin for anything else", () => {
    for (const next of [
      undefined,
      null,
      ["/admin/products"],
      "",
      "admin",
      "/",
      "/products/chair",
      "/administrator",
      "//evil.example/admin",
      "/\\evil.example/admin",
      "https://evil.example/admin",
      "/admin/login",
      "/admin/login?next=/admin",
    ]) {
      expect(safeAdminPath(next), String(next)).toBe("/admin");
    }
  });
});
