import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportRowInput } from "@/lib/domain/productImport";
import type { Category } from "@/lib/domain/types";
import { createCategoryService } from "@/lib/services/categoryService";
import { createProductImportService } from "@/lib/services/productImportService";
import { createProductService } from "@/lib/services/productService";
import { createFakeStore, type FakeStore } from "@/lib/services/testing/fakes";

// The product import actions (ticket 41), called directly the way a forged request would,
// against the real service rules on the in-memory fakes.

const requireAdmin = vi.fn();
vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: () => requireAdmin(),
}));

let store: FakeStore;
let office: Category;
let importService: ReturnType<typeof createProductImportService>;
vi.mock("@/lib/services", () => ({
  get productImportService() {
    return importService;
  },
  get productService() {
    return createProductService({
      products: store.productRepo,
      categories: store.categoryRepo,
      imageStore: store.imageStore,
    });
  },
  get categoryService() {
    return createCategoryService({ categories: store.categoryRepo });
  },
  publishService: {},
}));

const updateTag = vi.fn();
vi.mock("next/cache", () => ({
  refresh: vi.fn(),
  updateTag: (tag: string) => updateTag(tag),
}));

// What `unauthorized()` throws: Next's interrupts carry a digest.
class UnauthorizedInterrupt extends Error {
  digest = "NEXT_HTTP_ERROR_FALLBACK;401";
}

const { getProductsForExport, importProducts, previewProductImport } =
  await import("./actions");

const row = (overrides: Partial<ImportRowInput> = {}): ImportRowInput => ({
  code: "KK-001",
  name: "Mesh chair",
  category: "Office",
  unit: "pcs",
  price: "8950",
  stockStatus: "In stock",
  keySpec: "",
  description: "",
  specs: "",
  ...overrides,
});

const productCount = async () =>
  (await store.productRepo.listWithCategory()).length;

beforeEach(async () => {
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue({ id: "admin", email: "admin" });
  updateTag.mockReset();
  store = createFakeStore();
  importService = createProductImportService({
    products: store.productRepo,
    categories: store.categoryRepo,
  });
  office = await store.addCategory({ name: "Office" });
});

describe("previewProductImport", () => {
  it("returns the service's preview and writes nothing", async () => {
    const result = await previewProductImport([row()], [2]);
    expect(result).toMatchObject({ ok: true, data: { toCreate: 1 } });
    expect(await productCount()).toBe(0);
  });

  it("names Excel rows from the numbers it's given", async () => {
    const result = await previewProductImport(
      [row(), row({ code: "B" }), row({ code: "b" })],
      [2, 7, 12],
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { "rows.2.code": "Row 7 in this file uses the same code." },
    });
  });

  it("stops at the session check", async () => {
    requireAdmin.mockRejectedValue(new UnauthorizedInterrupt());
    await expect(previewProductImport([row()], [2])).rejects.toBeInstanceOf(
      UnauthorizedInterrupt,
    );
  });
});

describe("importProducts", () => {
  it("adds the products to the draft, without touching the store's cache", async () => {
    const result = await importProducts([row()], [2]);
    expect(result).toEqual({ ok: true, data: { created: 1, unchanged: 0 } });
    expect(await productCount()).toBe(1);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("stops at the session check and writes nothing", async () => {
    requireAdmin.mockRejectedValue(new UnauthorizedInterrupt());
    await expect(importProducts([row()], [2])).rejects.toBeInstanceOf(
      UnauthorizedInterrupt,
    );
    expect(await productCount()).toBe(0);
  });
});

describe("getProductsForExport", () => {
  it("returns every product as plain rows, with the category names", async () => {
    await store.addProduct({
      name: "Mesh chair",
      code: "",
      categoryId: office.id,
      priceCentavos: 895050,
      stockStatus: "low_stock",
      specs: "One\nTwo",
      isSample: true,
    });

    expect(await getProductsForExport()).toEqual({
      products: [
        {
          code: "",
          name: "Mesh chair",
          category: "Office",
          unit: "pcs",
          priceCentavos: 895050,
          stockStatus: "low_stock",
          keySpec: "",
          description: "",
          specs: "One\nTwo",
        },
      ],
      categories: [{ name: "Office" }],
    });
  });

  it("stops at the session check", async () => {
    requireAdmin.mockRejectedValue(new UnauthorizedInterrupt());
    await expect(getProductsForExport()).rejects.toBeInstanceOf(
      UnauthorizedInterrupt,
    );
  });
});
