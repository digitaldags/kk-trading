import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCodeTakenError } from "@/lib/domain/errors";
import type { ImportRowInput } from "@/lib/domain/productImport";
import type { Category } from "@/lib/domain/types";
import { createProductImportService } from "./productImportService";
import { createPublishService } from "./publishService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

let store: FakeStore;
let service: ReturnType<typeof createProductImportService>;
let office: Category;

beforeEach(async () => {
  store = createFakeStore();
  service = createProductImportService({
    products: store.productRepo,
    categories: store.categoryRepo,
  });
  office = await store.addCategory({ name: "Office" });
  await store.addCategory({ name: "Gym" });
});

const row = (overrides: Partial<ImportRowInput> = {}): ImportRowInput => ({
  code: "KK-001",
  name: "Mesh chair",
  category: "Office",
  unit: "pcs",
  price: "8950",
  stockStatus: "In stock",
  keySpec: "Breathable back",
  description: "A chair for long days.",
  specs: "Steel frame\nFive wheels",
  ...overrides,
});

const rowsOf = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    row({ code: `KK-${i}`, name: `Product ${i}` }),
  );

/** The same as `row()`, as a product already in the catalog. */
const addExisting = (overrides = {}) =>
  store.addProduct({
    name: "Mesh chair",
    code: "KK-001",
    categoryId: office.id,
    uom: "pcs",
    priceCentavos: 895000,
    stockStatus: "in_stock",
    keySpec: "Breathable back",
    description: "A chair for long days.",
    specs: "Steel frame\nFive wheels",
    ...overrides,
  });

const productCount = async () =>
  (await store.productRepo.listWithCategory()).length;

async function fieldErrors(rows: ImportRowInput[]) {
  const result = await service.preview(rows);
  if (result.ok) throw new Error("Expected errors");
  return result.fieldErrors;
}

describe("preview", () => {
  it("counts a valid file, gives each row its outcome, and writes nothing", async () => {
    await addExisting();
    const before = await productCount();

    const result = await service.preview([
      row(),
      row({ code: "KK-002", name: "Standing desk" }),
      row({ code: "KK-003", name: "Filing cabinet" }),
    ]);

    expect(result).toEqual({
      ok: true,
      data: {
        toCreate: 2,
        unchanged: 1,
        rows: [
          {
            index: 0,
            code: "KK-001",
            name: "Mesh chair",
            outcome: "unchanged",
          },
          {
            index: 1,
            code: "KK-002",
            name: "Standing desk",
            outcome: "create",
          },
          {
            index: 2,
            code: "KK-003",
            name: "Filing cabinet",
            outcome: "create",
          },
        ],
      },
    });
    expect(await productCount()).toBe(before);
  });

  it("reports every problem at once, on every bad row", async () => {
    const rows = rowsOf(50);
    rows[10] = row({ code: "BAD-1", name: "", price: "free" });
    rows[40] = row({ code: "BAD-2", category: "Offce" });

    expect(await fieldErrors(rows)).toEqual({
      "rows.10.name": "Enter a product name.",
      "rows.10.price": "Enter a price of 0 or more, numbers only.",
      "rows.40.category": "Unknown category “Offce”. Use one of: Office, Gym.",
    });
  });

  it("matches a category ignoring case and extra spaces", async () => {
    const result = await service.preview([row({ category: "  oFFiCe " })]);
    expect(result.ok).toBe(true);
  });

  it("asks for a category when the cell is blank", async () => {
    expect(await fieldErrors([row({ category: " " })])).toEqual({
      "rows.0.category": "Enter a category. Use one of: Office, Gym.",
    });
  });

  it("refuses a blank or unknown unit and stock status", async () => {
    expect(await fieldErrors([row({ unit: "", stockStatus: "" })])).toEqual({
      "rows.0.unit": "Choose a unit of measure.",
      "rows.0.stockStatus": "Choose a stock status.",
    });
    expect(
      await fieldErrors([row({ unit: "box", stockStatus: "Maybe" })]),
    ).toEqual({
      "rows.0.unit": "Choose a unit of measure.",
      "rows.0.stockStatus": "Choose a stock status.",
    });
  });

  it("accepts stock labels and stored values, and units in any case", async () => {
    const result = await service.preview([
      row({ code: "A", stockStatus: "low_stock", unit: "SET" }),
      row({ code: "B", stockStatus: "OUT OF STOCK", unit: "Pair" }),
    ]);
    expect(result.ok).toBe(true);
  });

  it("applies the editor's length limits", async () => {
    expect(
      await fieldErrors([
        row({
          code: "C".repeat(41),
          name: "N".repeat(81),
          keySpec: "K".repeat(91),
          description: "D".repeat(601),
          specs: "S".repeat(1001),
        }),
      ]),
    ).toEqual({
      "rows.0.code": "Use 40 characters or fewer.",
      "rows.0.name": "Use 80 characters or fewer.",
      "rows.0.keySpec": "Use 90 characters or fewer.",
      "rows.0.description": "Use 600 characters or fewer.",
      "rows.0.specs": "Use 1000 characters or fewer.",
    });
  });

  it("names the earlier row when a code repeats in another case", async () => {
    const rows = [row({ code: "kk-001" }), row({ code: "KK-001" })];
    expect(await fieldErrors(rows)).toEqual({
      "rows.1.code": "Row 2 in this file uses the same code.",
    });
  });

  it("names the earlier row's Excel row number, past any blank rows", async () => {
    const rows = [row({ code: "A" }), row({ code: "B" }), row({ code: "a" })];
    const result = await service.preview(rows, [2, 9, 14]);
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { "rows.2.code": "Row 2 in this file uses the same code." },
    });

    const later = await service.preview(
      [row({ code: "A" }), row({ code: "B" }), row({ code: "b" })],
      [2, 9, 14],
    );
    expect(later).toMatchObject({
      ok: false,
      fieldErrors: { "rows.2.code": "Row 9 in this file uses the same code." },
    });
  });

  it("treats a code in the catalog with the same values as unchanged, in any case", async () => {
    await addExisting();
    for (const code of ["KK-001", "kk-001", "  Kk-001 "]) {
      expect(await service.preview([row({ code })])).toMatchObject({
        ok: true,
        data: { toCreate: 0, unchanged: 1 },
      });
    }
  });

  it("compares after normalizing, and ignores the photo and the sample flag", async () => {
    await addExisting({
      isSample: true,
      imageUrl: "https://store.public.blob.vercel-storage.com/products/a.webp",
    });
    const result = await service.preview([
      row({
        name: "  Mesh chair ",
        price: "₱8,950.00",
        stockStatus: "in_stock",
        specs: "  Steel frame \r\n\r\nFive wheels\n",
      }),
    ]);
    expect(result).toMatchObject({ ok: true, data: { unchanged: 1 } });
  });

  it.each([
    [{ price: "1" }, "price"],
    [{ price: "1", stockStatus: "Low stock" }, "price and stock status"],
    [
      { name: "Other", price: "1", description: "New" },
      "name, price and description",
    ],
    [{ category: "Gym", unit: "set" }, "category and unit"],
    [{ keySpec: "New", specs: "New" }, "key spec and specifications"],
  ])("says what differs from the catalog: %j", async (overrides, fields) => {
    await addExisting();
    expect(await fieldErrors([row(overrides)])).toEqual({
      "rows.0.code": `KK-001 already exists with a different ${fields}. Edit it in the product editor.`,
    });
  });

  it("treats a code-less row identical to a code-less product as unchanged", async () => {
    await addExisting({ code: "" });
    expect(await service.preview([row({ code: "" })])).toMatchObject({
      ok: true,
      data: { toCreate: 0, unchanged: 1 },
    });
  });

  it("asks for a code when a code-less row differs from every code-less product", async () => {
    await addExisting({ code: "" });
    expect(await fieldErrors([row({ code: "", price: "1" })])).toEqual({
      "rows.0.code":
        "Enter a product code. If this is an existing product, remove it from the file.",
    });
  });

  it("doesn't match a code-less row to a product that has a code", async () => {
    await addExisting();
    expect(Object.keys(await fieldErrors([row({ code: " " })]))).toEqual([
      "rows.0.code",
    ]);
  });

  it("reports a missing code beside the row's other problems", async () => {
    expect(await fieldErrors([row({ code: "", price: "free" })])).toEqual({
      "rows.0.price": "Enter a price of 0 or more, numbers only.",
      "rows.0.code":
        "Enter a product code. If this is an existing product, remove it from the file.",
    });
  });

  it("doesn't compare a row that has other problems", async () => {
    await addExisting();
    expect(await fieldErrors([row({ price: "free", name: "Other" })])).toEqual({
      "rows.0.price": "Enter a price of 0 or more, numbers only.",
    });
  });

  it("refuses an empty list and more than 500 rows", async () => {
    expect(await service.preview([])).toEqual({
      ok: false,
      fieldErrors: {},
      formError: "The file has no products.",
    });
    expect(await service.preview(rowsOf(501))).toEqual({
      ok: false,
      fieldErrors: {},
      formError: "Import up to 500 products at a time.",
    });
    expect((await service.preview(rowsOf(500))).ok).toBe(true);
  });

  it("refuses rows that aren't text, as a forged request would send", async () => {
    for (const rows of [
      "rows",
      [null],
      [{ ...row(), price: 8950 }],
      [{ code: "A" }],
    ]) {
      expect(await service.preview(rows as ImportRowInput[])).toEqual({
        ok: false,
        fieldErrors: {},
        formError: "Reload the page and try again.",
      });
    }
  });

  it("ignores row numbers that aren't numbers", async () => {
    const result = await service.preview(
      [row(), row()],
      "nonsense" as unknown as number[],
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { "rows.1.code": "Row 2 in this file uses the same code." },
    });
  });
});

describe("commit", () => {
  it("adds the file's products as ordinary drafts, in file order", async () => {
    await addExisting({ sortOrder: 7 });

    const result = await service.commit([
      row(),
      row({ code: "KK-002", name: "Standing desk", unit: "set" }),
      row({ code: "KK-003", name: "Filing cabinet", stockStatus: "Low stock" }),
    ]);

    expect(result).toEqual({ ok: true, data: { created: 2, unchanged: 1 } });
    const desk = await store.productRepo.findByCode("KK-002");
    expect(desk).toMatchObject({
      name: "Standing desk",
      slug: "standing-desk",
      categoryId: office.id,
      uom: "set",
      priceCentavos: 895000,
      stockStatus: "in_stock",
      keySpec: "Breathable back",
      description: "A chair for long days.",
      specs: "Steel frame\nFive wheels",
      imageUrl: null,
      imagePathname: null,
      isSample: false,
      sortOrder: 8,
    });
    expect(await store.productRepo.findByCode("KK-003")).toMatchObject({
      stockStatus: "low_stock",
      sortOrder: 9,
    });
  });

  it("writes nothing when one row of 51 is bad, and returns every error", async () => {
    const rows = [...rowsOf(50), row({ code: "BAD", category: "Nope" })];
    const result = await service.commit(rows);
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        "rows.50.category": "Unknown category “Nope”. Use one of: Office, Gym.",
      },
    });
    expect(await productCount()).toBe(0);
  });

  it("creates nothing the second time the same file is imported", async () => {
    const rows = rowsOf(3);
    expect(await service.commit(rows)).toEqual({
      ok: true,
      data: { created: 3, unchanged: 0 },
    });

    const insertMany = vi.spyOn(store.productRepo, "insertMany");
    expect(await service.commit(rows)).toEqual({
      ok: true,
      data: { created: 0, unchanged: 3 },
    });
    expect(insertMany).not.toHaveBeenCalled();
    expect(await productCount()).toBe(3);
  });

  it("inserts once, however many rows there are", async () => {
    const insertMany = vi.spyOn(store.productRepo, "insertMany");
    await service.commit(rowsOf(20));
    expect(insertMany).toHaveBeenCalledTimes(1);
  });

  it("gives products with one name their own slugs", async () => {
    await service.commit([
      row({ code: "A", name: "Yoga mat" }),
      row({ code: "B", name: "Yoga mat" }),
      row({ code: "C", name: "Yoga mat" }),
    ]);
    const slugs = (await store.productRepo.listWithCategory()).map(
      (p) => p.slug,
    );
    expect(slugs).toEqual(["yoga-mat", "yoga-mat-2", "yoga-mat-3"]);
  });

  it("continues a name's numbering from the catalog", async () => {
    await store.addProduct({
      name: "Yoga mat",
      code: "OLD-1",
      slug: "yoga-mat",
      categoryId: office.id,
    });
    await store.addProduct({
      name: "Yoga mat",
      code: "OLD-2",
      slug: "yoga-mat-2",
      categoryId: office.id,
    });
    await service.commit([
      row({ code: "A", name: "Yoga mat" }),
      row({ code: "B", name: "Yoga mat" }),
    ]);
    expect((await store.productRepo.findByCode("A"))?.slug).toBe("yoga-mat-3");
    expect((await store.productRepo.findByCode("B"))?.slug).toBe("yoga-mat-4");
  });

  it("falls back to a generic slug for a name with no letters or digits", async () => {
    await service.commit([row({ code: "A", name: "★★★" })]);
    expect((await store.productRepo.findByCode("A"))?.slug).toBe("product");
  });

  it.each([
    ["8950", 895000],
    ["8,950", 895000],
    ["₱8,950.50", 895050],
    ["8950.5", 895050],
    ["0", 0],
  ])("reads the price %j", async (price, centavos) => {
    await service.commit([row({ price })]);
    expect((await store.productRepo.findByCode("KK-001"))?.priceCentavos).toBe(
      centavos,
    );
  });

  it("refuses a price with float noise from a number cell", async () => {
    expect(await fieldErrors([row({ price: "0.30000000000000004" })])).toEqual({
      "rows.0.price": "Enter a price of 0 or more, numbers only.",
    });
  });

  it("refuses an empty list and more than 500 rows", async () => {
    expect(await service.commit([])).toMatchObject({
      formError: "The file has no products.",
    });
    expect(await service.commit(rowsOf(501))).toMatchObject({
      formError: "Import up to 500 products at a time.",
    });
  });

  it("asks for a new preview when a code is taken after the check", async () => {
    store.failNextWrite(new ProductCodeTakenError("KK-7"));
    expect(await service.commit(rowsOf(10))).toEqual({
      ok: false,
      fieldErrors: {},
      formError:
        "Another product was added with the code KK-7 while you were importing. Preview the file again.",
    });
    expect(await productCount()).toBe(0);
  });

  it("still asks for a new preview when the error doesn't name the code", async () => {
    store.failNextWrite(new ProductCodeTakenError());
    expect(await service.commit(rowsOf(2))).toMatchObject({
      formError:
        "Another product took one of these codes while you were importing. Preview the file again.",
    });
  });

  it("lets any other database failure through", async () => {
    const failure = new Error("Connection lost");
    store.failNextWrite(failure);
    await expect(service.commit(rowsOf(2))).rejects.toBe(failure);
  });
});

describe("imports and publishing", () => {
  const publishService = () =>
    createPublishService({
      publish: store.publishRepo,
      products: store.productRepo,
      settings: store.settingsRepo,
      imageStore: store.imageStore,
    });

  it("leaves imported products in the draft until publish", async () => {
    const publish = publishService();
    await publish.publish();

    await service.commit(rowsOf(2));

    expect(await publish.status()).toEqual({ unpublished: true });
    expect((await store.publishRepo.getPublished())?.products).toEqual([]);

    await publish.publish();
    expect((await store.publishRepo.getPublished())?.products).toHaveLength(2);
  });

  it("removes imported products on Discard", async () => {
    const publish = publishService();
    await publish.publish();
    await service.commit(rowsOf(2));

    expect(await publish.discard()).toBe(true);

    expect(await productCount()).toBe(0);
    expect(await publish.status()).toEqual({ unpublished: false });
  });
});
