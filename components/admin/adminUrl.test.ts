import { describe, expect, it } from "vitest";
import {
  categoriesUrl,
  documentsUrl,
  productsUrl,
  quotationUrl,
} from "./adminUrl";

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

describe("categoriesUrl", () => {
  it("opens the editor for a new or an existing category", () => {
    expect(categoriesUrl()).toBe("/admin/categories");
    expect(categoriesUrl({ isNew: true })).toBe("/admin/categories?new=1");
    expect(categoriesUrl({ edit: "abc" })).toBe("/admin/categories?edit=abc");
  });
});

describe("documentsUrl", () => {
  it("leaves out empty values", () => {
    expect(documentsUrl()).toBe("/admin/documents");
    expect(documentsUrl({ q: " ", status: null })).toBe("/admin/documents");
  });

  it("combines the search and the status", () => {
    expect(documentsUrl({ q: " acme gym ", status: "draft" })).toBe(
      "/admin/documents?q=acme+gym&status=draft",
    );
    expect(documentsUrl({ status: "completed" })).toBe(
      "/admin/documents?status=completed",
    );
  });
});

describe("quotationUrl", () => {
  it("links one quotation", () => {
    expect(quotationUrl("abc")).toBe("/admin/documents/abc");
  });
});
