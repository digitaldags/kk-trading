import type { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "./client";
import { adminUsers, categories, products, storeSettings } from "./schema";
import { seed } from "./seed";
import { createTestDb, TEST_ADMIN } from "./testing/pglite";

let db: Db;
let client: PGlite;

beforeEach(async () => {
  ({ db, client } = await createTestDb());
});

afterEach(async () => {
  vi.restoreAllMocks();
  await client.close();
});

async function counts() {
  const n = async (table: PgTable) =>
    (await db.select({ n: count() }).from(table))[0]?.n;
  return {
    settings: await n(storeSettings),
    categories: await n(categories),
    products: await n(products),
    admins: await n(adminUsers),
  };
}

/** The Postgres error code, which Drizzle wraps in `cause`. */
async function pgErrorCode(query: PromiseLike<unknown>) {
  try {
    await query;
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code ?? (error as { code?: string }).code;
  }
  return "no error";
}

describe("migrations and seed", () => {
  it("seeds an empty database with the prototype content and one admin", async () => {
    const inserted = await seed(db, TEST_ADMIN);
    expect(inserted).toEqual({
      settings: 1,
      categories: 2,
      products: 8,
      admins: 1,
      published: true,
    });
    expect(await counts()).toEqual({
      settings: 1,
      categories: 2,
      products: 8,
      admins: 1,
    });

    const [barbell] = await db
      .select()
      .from(products)
      .where(eq(products.slug, "olympic-barbell-20-kg"));
    expect(barbell).toMatchObject({
      priceCentavos: 780000,
      stockStatus: "in_stock",
      isSample: true,
    });
  });

  it("changes nothing when the seed runs again", async () => {
    await seed(db, TEST_ADMIN);
    const before = {
      categories: await db.select().from(categories),
      products: await db.select().from(products),
      settings: await db.select().from(storeSettings),
      admins: await db.select().from(adminUsers),
    };

    const inserted = await seed(db, TEST_ADMIN);
    expect(inserted).toEqual({
      settings: 0,
      categories: 0,
      products: 0,
      admins: 0,
      published: false,
    });
    expect({
      categories: await db.select().from(categories),
      products: await db.select().from(products),
      settings: await db.select().from(storeSettings),
      admins: await db.select().from(adminUsers),
    }).toEqual(before);
  });

  it("hashes the admin password with argon2id and never logs it", async () => {
    const logs = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
    ];
    await seed(db, TEST_ADMIN);

    const [admin] = await db.select().from(adminUsers);
    expect(admin?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(admin?.passwordHash).not.toContain(TEST_ADMIN.password);
    const logged = logs.flatMap((spy) => spy.mock.calls.flat()).join(" ");
    expect(logged).not.toContain(TEST_ADMIN.password);
  });

  it("rejects an initial admin password shorter than 12 characters", async () => {
    await expect(
      seed(db, { email: "owner@example.com", password: "short" }),
    ).rejects.toThrow("at least 12 characters");
  });
});

describe("database rules", () => {
  beforeEach(async () => {
    await seed(db, TEST_ADMIN);
  });

  it("refuses to delete a category that still has products (on delete restrict)", async () => {
    expect(
      await pgErrorCode(
        db.delete(categories).where(eq(categories.slug, "gym")),
      ),
    ).toBe("23001"); // restrict_violation
  });

  it("treats category names as unique regardless of case", async () => {
    expect(
      await pgErrorCode(
        db
          .insert(categories)
          .values({ slug: "gym-2", name: "GYM EQUIPMENT", icon: "pool" }),
      ),
    ).toBe("23505");
  });

  it("rejects a negative price and an unknown stock status", async () => {
    const [gym] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, "gym"));
    const product = {
      slug: "x",
      categoryId: gym!.id,
      name: "X",
      code: "X",
      stockStatus: "in_stock" as const,
    };
    expect(
      await pgErrorCode(
        db.insert(products).values({ ...product, priceCentavos: -1 }),
      ),
    ).toBe("23514");
    expect(
      await pgErrorCode(
        db.insert(products).values({
          ...product,
          priceCentavos: 100,
          stockStatus: "sold" as "in_stock",
        }),
      ),
    ).toBe("23514");
    expect(
      await pgErrorCode(
        db.insert(products).values({
          ...product,
          priceCentavos: 100,
          uom: "box" as "pcs",
        }),
      ),
    ).toBe("23514");
  });

  it("treats product codes as unique regardless of case", async () => {
    const [gym] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, "gym"));
    expect(
      await pgErrorCode(
        db.insert(products).values({
          slug: "barbell-copy",
          categoryId: gym!.id,
          name: "Barbell copy",
          code: "kk-bar-01",
          priceCentavos: 100,
          stockStatus: "in_stock",
        }),
      ),
    ).toBe("23505");
  });

  it("defaults a product's code and specs to empty and its unit to pcs", async () => {
    const [gym] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, "gym"));
    const [row] = await db
      .insert(products)
      .values({
        slug: "plain",
        categoryId: gym!.id,
        name: "Plain",
        priceCentavos: 100,
        stockStatus: "in_stock",
      })
      .returning();
    expect(row).toMatchObject({ code: "", uom: "pcs", specs: "" });
  });

  it("lets any number of products have no code", async () => {
    const [gym] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, "gym"));
    const rows = await db
      .insert(products)
      .values(
        ["a", "b"].map((slug) => ({
          slug,
          categoryId: gym!.id,
          name: slug,
          code: "",
          priceCentavos: 100,
          stockStatus: "in_stock" as const,
        })),
      )
      .returning();
    expect(rows).toHaveLength(2);
  });

  it("allows only one settings row", async () => {
    expect(
      await pgErrorCode(
        db.insert(storeSettings).values({
          id: 2,
          name: "",
          headline: "",
          tagline: "",
          phone: "",
          email: "",
          address: "",
        }),
      ),
    ).toBe("23514");
  });
});
