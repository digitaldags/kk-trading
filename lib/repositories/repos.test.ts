import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/client";
import { queryRows } from "@/lib/db/publish";
import {
  createSeededTestDb,
  createTestDb,
  createTestDbAt,
  runMigrationSql,
  TEST_ADMIN,
} from "@/lib/db/testing/pglite";
import { ProductCodeTakenError } from "@/lib/domain/errors";
import { createAdminUserRepo } from "./adminUserRepo";
import { createCategoryRepo } from "./categoryRepo";
import { createLoginAttemptRepo } from "./loginAttemptRepo";
import { createProductRepo } from "./productRepo";
import { createPublishRepo } from "./publishRepo";
import { createSettingsRepo } from "./settingsRepo";

// The repositories' SQL against real Postgres (PGlite), with the seed loaded.
// Read-only tests share one database; tests that write make their own.

// Those tests seed a PGlite database inside the test, which took over 5s under
// `pnpm test:coverage` once the suite grew (2026-10-31).
vi.setConfig({ testTimeout: 20_000 });

let db: Db;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await createSeededTestDb());
});

afterAll(async () => {
  await client.close();
});

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("productRepo.listWithCategory", () => {
  it("orders by category, then product sort order", async () => {
    const rows = await createProductRepo(db).listWithCategory();
    expect(names(rows)).toEqual([
      "Ergonomic mesh chair",
      "Electric standing desk",
      "Steel 4-drawer filing cabinet",
      "Dual monitor arm",
      "Olympic barbell 20 kg",
      "Adjustable FID bench",
      "Power rack with J-hooks",
      "Rubber hex dumbbells, pair",
    ]);
    expect(rows[0]?.category).toMatchObject({ slug: "office", icon: "chair" });
  });

  it("filters by category", async () => {
    const gym = await createCategoryRepo(db).findBySlug("gym");
    const rows = await createProductRepo(db).listWithCategory({
      categoryId: gym!.id,
    });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.category.slug === "gym")).toBe(true);
  });

  it("searches name, key spec and description, ignoring case", async () => {
    const repo = createProductRepo(db);
    expect(names(await repo.listWithCategory({ q: "BENCH" }))).toEqual([
      "Adjustable FID bench",
    ]);
    // Key spec: "Legal size · Central lock"
    expect(names(await repo.listWithCategory({ q: "central LOCK" }))).toEqual([
      "Steel 4-drawer filing cabinet",
    ]);
    // Description: "... Sold as a pair."
    expect(names(await repo.listWithCategory({ q: "sold as" }))).toEqual([
      "Rubber hex dumbbells, pair",
    ]);
  });

  it("treats % and _ in the search as plain text", async () => {
    const repo = createProductRepo(db);
    expect(await repo.listWithCategory({ q: "%" })).toEqual([]);
    expect(await repo.listWithCategory({ q: "_" })).toEqual([]);
  });

  it("finds a product by slug with its category", async () => {
    const product = await createProductRepo(db).findBySlug(
      "olympic-barbell-20-kg",
    );
    expect(product).toMatchObject({
      name: "Olympic barbell 20 kg",
      category: { slug: "gym" },
    });
  });
});

describe("productRepo.isImageInUse", () => {
  it("is true only for a photo a product shows", async () => {
    const own = await createSeededTestDb();
    try {
      const repo = createProductRepo(own.db);
      const url =
        "https://store.public.blob.vercel-storage.com/products/a.webp";
      expect(await repo.isImageInUse(url)).toBe(false);
      const [first] = await repo.listWithCategory();
      await repo.update(first!.id, {
        imageUrl: url,
        imagePathname: "products/a.webp",
      });
      expect(await repo.isImageInUse(url)).toBe(true);
    } finally {
      await own.client.close();
    }
  });
});

describe("product codes", () => {
  it("finds a product by code, ignoring case", async () => {
    const repo = createProductRepo(db);
    expect((await repo.findByCode("kk-chair-01"))?.name).toBe(
      "Ergonomic mesh chair",
    );
    expect(await repo.findByCode("KK-NOPE")).toBeNull();
  });

  it("seeds each product with a unique code, a unit and spec lines", async () => {
    const rows = await createProductRepo(db).listWithCategory();
    const codes = rows.map((r) => r.code.toLowerCase());
    expect(new Set(codes).size).toBe(rows.length);
    expect(rows.every((r) => /^KK-[A-Z0-9-]+$/.test(r.code))).toBe(true);
    expect(rows.every((r) => r.specs.split("\n").length >= 2)).toBe(true);
    expect(rows.find((r) => r.name === "Rubber hex dumbbells, pair")?.uom).toBe(
      "pair",
    );
  });

  it("throws ProductCodeTakenError when the unique index refuses a write", async () => {
    const own = await createSeededTestDb();
    try {
      const repo = createProductRepo(own.db);
      const [chair, desk] = await repo.listWithCategory();
      const {
        id: _id,
        createdAt: _c,
        updatedAt: _u,
        category: _cat,
        ...copy
      } = chair!;
      await expect(
        repo.insert({ ...copy, slug: "chair-copy", code: "kk-chair-01" }),
      ).rejects.toBeInstanceOf(ProductCodeTakenError);
      await expect(
        repo.update(desk!.id, { code: "Kk-Chair-01" }),
      ).rejects.toBeInstanceOf(ProductCodeTakenError);
      // Any other database error is rethrown as is.
      await expect(
        repo.update(desk!.id, { priceCentavos: -1 }),
      ).rejects.not.toBeInstanceOf(ProductCodeTakenError);
    } finally {
      await own.client.close();
    }
  });
});

describe("settingsRepo.isLogoInUse", () => {
  it("is true for the draft's logo and for the published one", async () => {
    const own = await createSeededTestDb();
    try {
      const settings = createSettingsRepo(own.db);
      const publish = createPublishRepo(own.db);
      const logo = (name: string) =>
        `https://store.public.blob.vercel-storage.com/branding/${name}.png`;
      const { updatedAt: _, ...values } = (await settings.get())!;

      expect(await settings.isLogoInUse(logo("a"))).toBe(false);
      await settings.update({
        ...values,
        logoUrl: logo("a"),
        logoPathname: "branding/a.png",
      });
      expect(await settings.isLogoInUse(logo("a"))).toBe(true);

      await publish.publish();
      await settings.update({
        ...values,
        logoUrl: logo("b"),
        logoPathname: "branding/b.png",
      });
      // The draft shows b, the storefront still shows a.
      expect(await settings.isLogoInUse(logo("a"))).toBe(true);
      expect(await settings.isLogoInUse(logo("b"))).toBe(true);

      await publish.publish();
      expect(await settings.isLogoInUse(logo("a"))).toBe(false);
      expect((await publish.getPublished())?.settings).toMatchObject({
        logoUrl: logo("b"),
        logoPathname: "branding/b.png",
      });
    } finally {
      await own.client.close();
    }
  });
});

describe("ids that aren't uuids", () => {
  // Why the services check ids before calling a repository.
  it("make Postgres throw instead of finding nothing", async () => {
    await expect(createProductRepo(db).findById("abc")).rejects.toThrow();
  });
});

describe("categoryRepo", () => {
  it("lists categories with product counts", async () => {
    const rows = await createCategoryRepo(db).list();
    expect(rows.map((r) => [r.slug, r.productCount])).toEqual([
      ["office", 4],
      ["gym", 4],
    ]);
  });

  it("finds a category by name in any case", async () => {
    const found = await createCategoryRepo(db).findByName("GYM EQUIPMENT");
    expect(found?.slug).toBe("gym");
  });

  it("finds taken slugs by prefix", async () => {
    expect(await createProductRepo(db).slugsStartingWith("ergonomic")).toEqual([
      "ergonomic-mesh-chair",
    ]);
  });
});

describe("categoryRepo.moveProductsAndDelete", () => {
  it("moves the products, then deletes the category", async () => {
    const { db: fresh, client: freshClient } = await createSeededTestDb();
    const repo = createCategoryRepo(fresh);
    const gym = await repo.findBySlug("gym");
    const office = await repo.findBySlug("office");

    await repo.moveProductsAndDelete(gym!.id, office!.id);

    expect(await repo.findBySlug("gym")).toBeNull();
    expect(await repo.countProducts(office!.id)).toBe(8);
    await freshClient.close();
  });

  it("rolls the move back when the delete fails", async () => {
    const { db: fresh, client: freshClient } = await createSeededTestDb();
    const repo = createCategoryRepo(fresh);
    const gym = await repo.findBySlug("gym");
    const office = await repo.findBySlug("office");

    // Make the delete (the second statement) fail after the products have moved.
    await freshClient.exec(`
      create function block_delete() returns trigger language plpgsql as
        $$ begin raise exception 'delete blocked by test'; end $$;
      create trigger block_delete before delete on categories
        for each row execute function block_delete();
    `);

    await expect(
      repo.moveProductsAndDelete(gym!.id, office!.id),
    ).rejects.toThrow();

    expect(await repo.findBySlug("gym")).not.toBeNull();
    expect(await repo.countProducts(gym!.id)).toBe(4);
    expect(await repo.countProducts(office!.id)).toBe(4);
    await freshClient.close();
  });
});

describe("categoryRepo.setSortOrders", () => {
  it("sets the storefront order from the list of ids", async () => {
    const { db: fresh, client: freshClient } = await createSeededTestDb();
    try {
      const repo = createCategoryRepo(fresh);
      const [office, gym] = await repo.list();
      await repo.setSortOrders([gym!.id, office!.id]);
      expect((await repo.list()).map((c) => [c.slug, c.sortOrder])).toEqual([
        ["gym", 0],
        ["office", 1],
      ]);
    } finally {
      await freshClient.close();
    }
  });
});

describe("publishRepo (draft and publish)", () => {
  async function withFreshDb(
    run: (repos: {
      publish: ReturnType<typeof createPublishRepo>;
      products: ReturnType<typeof createProductRepo>;
      categories: ReturnType<typeof createCategoryRepo>;
      settings: ReturnType<typeof createSettingsRepo>;
    }) => Promise<void>,
  ) {
    const own = await createSeededTestDb();
    try {
      await run({
        publish: createPublishRepo(own.db),
        products: createProductRepo(own.db),
        categories: createCategoryRepo(own.db),
        settings: createSettingsRepo(own.db),
      });
    } finally {
      await own.client.close();
    }
  }

  it("the seed publishes a fresh database, and the copy reads back as domain types", async () => {
    await withFreshDb(async ({ publish, products }) => {
      const published = await publish.getPublished();
      expect(published?.settings?.name).toBe("KK Trading");
      expect(
        published?.categories.map((c) => [c.slug, c.productCount]),
      ).toEqual([
        ["office", 4],
        ["gym", 4],
      ]);
      // Same products, same order, same fields as the live tables.
      expect(published?.products).toEqual(await products.listWithCategory());
      expect(await publish.hasUnpublishedChanges()).toBe(false);
    });
  });

  it("keeps showing the published copy until the draft is published", async () => {
    await withFreshDb(async ({ publish, products, settings }) => {
      const [chair] = await products.listWithCategory({ q: "mesh chair" });
      await products.update(chair!.id, { name: "Mesh office chair" });
      const current = await settings.get();
      const { updatedAt: _, ...values } = current!;
      await settings.update({ ...values, name: "KK Trading PH" });

      expect(await publish.hasUnpublishedChanges()).toBe(true);
      let published = await publish.getPublished();
      expect(published?.products[0]?.name).toBe("Ergonomic mesh chair");
      expect(published?.settings?.name).toBe("KK Trading");

      await publish.publish();
      published = await publish.getPublished();
      expect(published?.products[0]?.name).toBe("Mesh office chair");
      expect(published?.settings?.name).toBe("KK Trading PH");
      expect(await publish.hasUnpublishedChanges()).toBe(false);
    });
  });

  it("ignores a save that only moves the timestamps", async () => {
    await withFreshDb(async ({ publish, categories }) => {
      const [office] = await categories.list();
      await categories.update(office!.id, { name: office!.name });
      expect(await publish.hasUnpublishedChanges()).toBe(false);
    });
  });

  it("discard restores a deleted category with its products, and drops what was added", async () => {
    await withFreshDb(async ({ publish, products, categories }) => {
      const before = await products.listWithCategory();
      const gym = await categories.findBySlug("gym");
      const office = await categories.findBySlug("office");
      await categories.moveProductsAndDelete(gym!.id, office!.id);
      await products.insert({
        slug: "added-since",
        categoryId: office!.id,
        name: "Added since",
        code: "ADDED-SINCE",
        uom: "pcs",
        specs: "",
        priceCentavos: 100,
        stockStatus: "in_stock",
        keySpec: "",
        description: "",
        imageUrl: null,
        imagePathname: null,
        isSample: false,
        sortOrder: 99,
      });
      expect(await publish.hasUnpublishedChanges()).toBe(true);

      expect(await publish.discard()).toBe(true);
      expect(await products.listWithCategory()).toEqual(before);
      expect((await categories.findBySlug("gym"))?.id).toBe(gym!.id);
      expect(await publish.hasUnpublishedChanges()).toBe(false);
    });
  });

  it("discard after editing a code restores the products and the store details", async () => {
    await withFreshDb(async ({ publish, products, settings }) => {
      const before = await products.listWithCategory();
      const settingsBefore = await settings.get();
      const [chair] = before;
      await products.update(chair!.id, {
        code: "KK-CHAIR-99",
        uom: "set",
        specs: "Changed",
      });
      const { updatedAt: _, ...values } = settingsBefore!;
      await settings.update({
        ...values,
        slogan: "Changed",
        phone2: "0917 111 1111",
        logoUrl:
          "https://store.public.blob.vercel-storage.com/branding/draft.png",
        logoPathname: "branding/draft.png",
      });
      expect(await publish.hasUnpublishedChanges()).toBe(true);

      expect(await publish.discard()).toBe(true);
      expect(await products.listWithCategory()).toEqual(before);
      expect(await settings.get()).toMatchObject({
        slogan: settingsBefore!.slogan,
        phone2: settingsBefore!.phone2,
        logoUrl: null,
        logoPathname: null,
      });
      expect(await publish.hasUnpublishedChanges()).toBe(false);
    });
  });

  it("finds a photo only the published copy still shows", async () => {
    await withFreshDb(async ({ publish, products }) => {
      const url =
        "https://store.public.blob.vercel-storage.com/products/published.webp";
      const [first] = await products.listWithCategory();
      await products.update(first!.id, {
        imageUrl: url,
        imagePathname: "products/published.webp",
      });
      await publish.publish();
      await products.update(first!.id, { imageUrl: null, imagePathname: null });
      expect(await products.isImageInUse(url)).toBe(true);
      await publish.publish();
      expect(await products.isImageInUse(url)).toBe(false);
    });
  });
});

describe("the published_snapshot migration", () => {
  it("starts an empty database with an empty published copy", async () => {
    const { db: empty, client: emptyClient } = await createTestDb();
    try {
      const published = await createPublishRepo(empty).getPublished();
      expect(published).toMatchObject({
        categories: [],
        products: [],
        settings: null,
      });
    } finally {
      await emptyClient.close();
    }
  });
});

describe("the document_fields migration (0002) on existing data", () => {
  // A store as it was before ticket 17: migrated to 0001, with rows and a publish.
  async function storeBefore0002() {
    const old = await createTestDbAt("0001_published_snapshot");
    await old.client.exec(`
      insert into store_settings (id, name, headline, tagline, phone, email, address)
      values (1, 'KK Trading', 'Equipment', '', '0917', 'hello@example.com', '');
      insert into categories (id, slug, name, icon, sort_order)
      values ('00000000-0000-4000-8000-0000000000c1', 'office', 'Office', 'chair', 0);
      insert into products (id, slug, category_id, name, price_centavos, stock_status, sort_order)
      values
        ('00000000-0000-4000-8000-000000000001', 'ergonomic-mesh-chair',
         '00000000-0000-4000-8000-0000000000c1', 'Ergonomic mesh chair', 895000, 'in_stock', 0),
        ('00000000-0000-4000-8000-000000000002', 'ergonomic-mesh-chair-2',
         '00000000-0000-4000-8000-0000000000c1', 'Ergonomic mesh chair', 900000, 'in_stock', 1);
      insert into published_snapshot (id, data, published_at)
      values (1, jsonb_build_object(
        'categories', (select jsonb_agg(to_jsonb(c) order by c.id::text) from categories c),
        'products', (select jsonb_agg(to_jsonb(p) order by p.id::text) from products p),
        'settings', (select to_jsonb(s) from store_settings s where s.id = 1)
      ), now())
      on conflict (id) do update set data = excluded.data;
    `);
    await runMigrationSql(old.client, "0002_document_fields");
    await runMigrationSql(old.client, "0003_optional_product_code");
    // The rest, so the repositories' selects find every column they name.
    await runMigrationSql(old.client, "0004_documents");
    await runMigrationSql(old.client, "0005_logo_size");
    return old;
  }

  it("gives every product a unique code from its slug and keeps the store published", async () => {
    const { db: migrated, client: migratedClient } = await storeBefore0002();
    try {
      const products = createProductRepo(migrated);
      const publish = createPublishRepo(migrated);
      expect(
        (await products.listWithCategory()).map((p) => [
          p.code,
          p.uom,
          p.specs,
        ]),
      ).toEqual([
        ["ERGONOMIC-MESH-CHAIR", "pcs", ""],
        ["ERGONOMIC-MESH-CHAIR-2", "pcs", ""],
      ]);
      // "All changes live" still holds: the snapshot got the same values.
      expect(await publish.hasUnpublishedChanges()).toBe(false);
      const published = await publish.getPublished();
      expect(published?.products.map((p) => p.code)).toEqual([
        "ERGONOMIC-MESH-CHAIR",
        "ERGONOMIC-MESH-CHAIR-2",
      ]);
      expect(published?.settings).toMatchObject({
        slogan: "",
        phone2: "",
        logoUrl: null,
        logoPathname: null,
      });
    } finally {
      await migratedClient.close();
    }
  });

  it("lets Discard restore products and settings from the backfilled snapshot", async () => {
    const { db: migrated, client: migratedClient } = await storeBefore0002();
    try {
      const products = createProductRepo(migrated);
      const settings = createSettingsRepo(migrated);
      const publish = createPublishRepo(migrated);
      const [chair] = await products.listWithCategory();
      await products.update(chair!.id, { code: "KK-CHAIR-01" });
      const { updatedAt: _, ...values } = (await settings.get())!;
      await settings.update({ ...values, slogan: "FOUNDATION TO FURNISH" });

      expect(await publish.discard()).toBe(true);
      expect((await products.findById(chair!.id))?.code).toBe(
        "ERGONOMIC-MESH-CHAIR",
      );
      expect((await settings.get())?.slogan).toBe("");
      expect(await publish.hasUnpublishedChanges()).toBe(false);
    } finally {
      await migratedClient.close();
    }
  });

  it("leaves a snapshot published before the seed without settings", async () => {
    const old = await createTestDbAt("0001_published_snapshot");
    try {
      await runMigrationSql(old.client, "0002_document_fields");
      const [row] = await queryRows<{ data: Record<string, unknown> }>(
        old.db,
        sql`select data from published_snapshot where id = 1`,
      );
      expect(row?.data).toEqual({
        categories: [],
        products: [],
        settings: null,
      });
    } finally {
      await old.client.close();
    }
  });
});

describe("the logo_size migration (0005) on existing data", () => {
  const LOGO = "https://x.public.blob.vercel-storage.com/branding/kk-logo.png";

  // A store as it was before ticket 40: a logo saved and published, with no size.
  async function storeBefore0005() {
    const old = await createTestDbAt("0004_documents");
    await old.client.exec(`
      insert into store_settings (id, name, headline, tagline, phone, email, address,
        logo_url, logo_pathname)
      values (1, 'KK Trading', 'Equipment', '', '0917', 'hello@example.com', '',
        '${LOGO}', 'branding/kk-logo.png');
      insert into published_snapshot (id, data, published_at)
      values (1, jsonb_build_object(
        'categories', '[]'::jsonb,
        'products', '[]'::jsonb,
        'settings', (select to_jsonb(s) from store_settings s where s.id = 1)
      ), now())
      on conflict (id) do update set data = excluded.data;
    `);
    await runMigrationSql(old.client, "0005_logo_size");
    return old;
  }

  it("keeps the store published, with the logo and no size", async () => {
    const { db: migrated, client: migratedClient } = await storeBefore0005();
    try {
      const publish = createPublishRepo(migrated);
      expect(await publish.hasUnpublishedChanges()).toBe(false);
      expect((await publish.getPublished())?.settings).toMatchObject({
        logoUrl: LOGO,
        logoWidth: null,
        logoHeight: null,
      });
      expect(await createSettingsRepo(migrated).get()).toMatchObject({
        logoUrl: LOGO,
        logoWidth: null,
        logoHeight: null,
      });
    } finally {
      await migratedClient.close();
    }
  });

  it("lets Discard put back the published logo size", async () => {
    const { db: migrated, client: migratedClient } = await storeBefore0005();
    try {
      const settings = createSettingsRepo(migrated);
      const publish = createPublishRepo(migrated);
      const { updatedAt: _, ...values } = (await settings.get())!;
      await settings.update({ ...values, logoWidth: 400, logoHeight: 100 });
      await publish.publish();
      expect((await publish.getPublished())?.settings).toMatchObject({
        logoWidth: 400,
        logoHeight: 100,
      });

      await settings.update({
        ...values,
        logoUrl: null,
        logoPathname: null,
        logoWidth: null,
        logoHeight: null,
      });
      expect(await publish.discard()).toBe(true);
      expect(await settings.get()).toMatchObject({
        logoUrl: LOGO,
        logoWidth: 400,
        logoHeight: 100,
      });
      expect(await publish.hasUnpublishedChanges()).toBe(false);
    } finally {
      await migratedClient.close();
    }
  });

  it("refuses a width without a height", async () => {
    const { client: migratedClient } = await storeBefore0005();
    try {
      await expect(
        migratedClient.exec(
          "update store_settings set logo_width = 400 where id = 1",
        ),
      ).rejects.toThrow(/store_settings_logo_size_check/);
    } finally {
      await migratedClient.close();
    }
  });
});

describe("settings, admin users and login attempts", () => {
  it("reads and updates the single settings row", async () => {
    const repo = createSettingsRepo(db);
    const before = await repo.get();
    expect(before?.name).toBe("KK Trading");
    const after = await repo.update({ ...before!, address: "Quezon City" });
    expect(after.address).toBe("Quezon City");
    expect(after).not.toHaveProperty("id");
  });

  it("finds the admin by email in any case", async () => {
    const admin = await createAdminUserRepo(db).findByEmail(
      ` ${TEST_ADMIN.email.toUpperCase()} `,
    );
    expect(admin?.email).toBe(TEST_ADMIN.email);
  });

  it("adds an admin with the email lowercased", async () => {
    const repo = createAdminUserRepo(db);
    const added = await repo.insert({
      email: " Second@Example.com ",
      passwordHash: "$argon2id$second",
    });
    expect(added.email).toBe("second@example.com");
    expect((await repo.findByEmail("SECOND@example.com"))?.id).toBe(added.id);
  });

  it("moves passwordChangedAt forward when the password changes", async () => {
    const repo = createAdminUserRepo(db);
    const admin = await repo.findByEmail(TEST_ADMIN.email);
    const updated = await repo.updatePassword(admin!.id, "$argon2id$new");
    expect(updated!.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(
      admin!.passwordChangedAt.getTime(),
    );
    expect(updated!.passwordHash).toBe("$argon2id$new");
  });

  it("counts recent failed sign-ins by email and by IP", async () => {
    const repo = createLoginAttemptRepo(db);
    const since = new Date(Date.now() - 60_000);
    await repo.record({
      email: "Owner@Example.com",
      ip: "1.2.3.4",
      succeeded: false,
    });
    await repo.record({
      email: "owner@example.com",
      ip: "5.6.7.8",
      succeeded: false,
    });
    await repo.record({
      email: "owner@example.com",
      ip: "1.2.3.4",
      succeeded: true,
    });

    expect(await repo.countFailuresByEmail("OWNER@example.com", since)).toBe(2);
    expect(await repo.countFailuresByIp("1.2.3.4", since)).toBe(1);
    expect(await repo.countFailuresByIp("1.2.3.4", new Date())).toBe(0);
  });
});
