import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSeededTestDb } from "@/lib/db/testing/pglite";
import { ProductCodeTakenError } from "@/lib/domain/errors";
import { createFakeStore } from "@/lib/services/testing/fakes";
import { createProductRepo } from "./productRepo";
import type { NewProduct, ProductRepo } from "./types";

// `insertMany` (ticket 41) on Postgres and on the fake the service tests use, so the fake
// can't drift from what the database refuses.

type Repos = {
  products: ProductRepo;
  categoryId: string;
  /** A code already in the catalog. */
  takenCode: string;
  close: () => Promise<void>;
};

const backends: [string, () => Promise<Repos>][] = [
  [
    "PGlite",
    async () => {
      const { db, client } = await createSeededTestDb();
      const products = createProductRepo(db);
      const [first] = await products.listWithCategory();
      return {
        products,
        categoryId: first!.categoryId,
        takenCode: first!.code,
        close: () => client.close(),
      };
    },
  ],
  [
    "fakes",
    async () => {
      const store = createFakeStore();
      const office = await store.addCategory({ name: "Office" });
      const chair = await store.addProduct({
        name: "Chair",
        categoryId: office.id,
      });
      return {
        products: store.productRepo,
        categoryId: office.id,
        takenCode: chair.code,
        close: async () => {},
      };
    },
  ],
];

describe.each(backends)("insertMany on %s", (_name, open) => {
  let repos: Repos;
  let nextSortOrder: number;

  const product = (code: string, name = `Product ${code}`): NewProduct => ({
    slug: `import-${nextSortOrder}`,
    categoryId: repos.categoryId,
    name,
    code,
    uom: "pcs",
    specs: "",
    priceCentavos: 100,
    stockStatus: "in_stock",
    keySpec: "",
    description: "",
    imageUrl: null,
    imagePathname: null,
    isSample: false,
    sortOrder: nextSortOrder++,
  });

  const count = async () => (await repos.products.listWithCategory()).length;

  beforeEach(async () => {
    repos = await open();
    nextSortOrder = (await repos.products.maxSortOrder()) + 1;
  });

  afterEach(async () => {
    await repos.close();
  });

  it("inserts every row in order and returns them", async () => {
    const start = nextSortOrder;
    const rows = await repos.products.insertMany([
      product("IMP-1"),
      product("IMP-2"),
      product("IMP-3"),
    ]);

    expect(rows.map((r) => r.code)).toEqual(["IMP-1", "IMP-2", "IMP-3"]);
    expect(rows.every((r) => r.id)).toBe(true);
    expect(rows.map((r) => r.sortOrder)).toEqual([start, start + 1, start + 2]);
    expect(await repos.products.maxSortOrder()).toBe(start + 2);
    expect(await repos.products.findByCode("imp-2")).toMatchObject({
      name: "Product IMP-2",
    });
  });

  it("does nothing with an empty list", async () => {
    const before = await count();
    expect(await repos.products.insertMany([])).toEqual([]);
    expect(await count()).toBe(before);
  });

  it("inserts none when a code is already taken, in another case", async () => {
    const before = await count();
    const refused = await repos.products
      .insertMany([
        product("IMP-1"),
        product(repos.takenCode.toLowerCase()),
        product("IMP-3"),
      ])
      .catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(ProductCodeTakenError);
    expect((refused as ProductCodeTakenError).code).toBe(
      repos.takenCode.toLowerCase(),
    );
    expect(await count()).toBe(before);
    expect(await repos.products.findByCode("IMP-1")).toBeNull();
  });

  it("inserts none when two rows share a code, ignoring case", async () => {
    const before = await count();
    const refused = await repos.products
      .insertMany([product("imp-1"), product("IMP-1"), product("IMP-3")])
      .catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(ProductCodeTakenError);
    expect((refused as ProductCodeTakenError).code?.toLowerCase()).toBe(
      "imp-1",
    );
    expect(await count()).toBe(before);
  });

  it("lets any number of rows have no code", async () => {
    const rows = await repos.products.insertMany([
      product("", "No code one"),
      product("", "No code two"),
    ]);
    expect(rows).toHaveLength(2);
  });
});
