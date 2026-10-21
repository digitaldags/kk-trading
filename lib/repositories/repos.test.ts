import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { createSeededTestDb, TEST_ADMIN } from "@/lib/db/testing/pglite";
import { createAdminUserRepo } from "./adminUserRepo";
import { createCategoryRepo } from "./categoryRepo";
import { createLoginAttemptRepo } from "./loginAttemptRepo";
import { createProductRepo } from "./productRepo";
import { createSettingsRepo } from "./settingsRepo";

// The repositories' SQL against real Postgres (PGlite), with the seed loaded.
// Read-only tests share one database; tests that write make their own.

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
