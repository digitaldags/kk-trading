import { hash } from "@node-rs/argon2";
import { inArray, sql } from "drizzle-orm";
import { slugify } from "@/lib/domain/slug";
import type { Db } from "./client";
import { adminUsers, categories, products, storeSettings } from "./schema";
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_SETTINGS } from "./seed-data";

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

export type SeedAdmin = { email: string; password: string };

export type SeedResult = {
  settings: number;
  categories: number;
  products: number;
  admins: number;
};

/**
 * Inserts the prototype content and the first admin. Rows that already exist (by slug,
 * id 1 or email) are left alone, so running it again changes nothing and never
 * overwrites edits made in admin. Returns how many rows were inserted.
 */
export async function seed(
  db: Db,
  admin: SeedAdmin | undefined,
): Promise<SeedResult> {
  const settingsRows = await db
    .insert(storeSettings)
    .values({ id: 1, ...SEED_SETTINGS })
    .onConflictDoNothing()
    .returning({ id: storeSettings.id });

  const categoryRows = await db
    .insert(categories)
    .values(SEED_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })))
    .onConflictDoNothing()
    .returning({ id: categories.id });

  const categoryIds = new Map(
    (
      await db
        .select({ id: categories.id, slug: categories.slug })
        .from(categories)
        .where(
          inArray(
            categories.slug,
            SEED_CATEGORIES.map((c) => c.slug),
          ),
        )
    ).map((c) => [c.slug, c.id]),
  );

  const productValues = SEED_PRODUCTS.flatMap(({ category, ...product }, i) => {
    const categoryId = categoryIds.get(category);
    // The category was renamed to another slug or removed in admin. Skip its products.
    if (!categoryId) return [];
    return [
      {
        ...product,
        slug: slugify(product.name),
        categoryId,
        isSample: true,
        sortOrder: i,
      },
    ];
  });
  const productRows = productValues.length
    ? await db
        .insert(products)
        .values(productValues)
        .onConflictDoNothing()
        .returning({ id: products.id })
    : [];

  const admins = admin ? await seedAdmin(db, admin) : 0;

  return {
    settings: settingsRows.length,
    categories: categoryRows.length,
    products: productRows.length,
    admins,
  };
}

async function seedAdmin(db: Db, { email, password }: SeedAdmin) {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${normalized}`);
  if (existing) return 0;

  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_INITIAL_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    );
  }
  // @node-rs/argon2 defaults to argon2id.
  const passwordHash = await hash(password);
  const rows = await db
    .insert(adminUsers)
    .values({ email: normalized, passwordHash })
    .onConflictDoNothing()
    .returning({ id: adminUsers.id });
  return rows.length;
}
