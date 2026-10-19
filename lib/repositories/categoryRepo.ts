import { asc, count, eq, like, max, sql } from "drizzle-orm";
import { atomic } from "@/lib/db/atomic";
import type { Db } from "@/lib/db/client";
import { categories, products } from "@/lib/db/schema";
import { escapeLike } from "./like";
import type { CategoryRepo } from "./types";

export function createCategoryRepo(db: Db): CategoryRepo {
  return {
    async list() {
      const rows = await db
        .select({ category: categories, productCount: count(products.id) })
        .from(categories)
        .leftJoin(products, eq(products.categoryId, categories.id))
        .groupBy(categories.id)
        .orderBy(asc(categories.sortOrder), asc(categories.name));
      return rows.map((r) => ({ ...r.category, productCount: r.productCount }));
    },

    async findById(id) {
      const [row] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id));
      return row ?? null;
    },

    async findBySlug(slug) {
      const [row] = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug));
      return row ?? null;
    },

    async findByName(name) {
      const [row] = await db
        .select()
        .from(categories)
        .where(sql`lower(${categories.name}) = lower(${name.trim()})`);
      return row ?? null;
    },

    async slugsStartingWith(prefix) {
      const rows = await db
        .select({ slug: categories.slug })
        .from(categories)
        .where(like(categories.slug, `${escapeLike(prefix)}%`));
      return rows.map((r) => r.slug);
    },

    async maxSortOrder() {
      const [row] = await db
        .select({ value: max(categories.sortOrder) })
        .from(categories);
      return row?.value ?? -1;
    },

    async countProducts(id) {
      const [row] = await db
        .select({ n: count() })
        .from(products)
        .where(eq(products.categoryId, id));
      return row?.n ?? 0;
    },

    async insert(values) {
      const [row] = await db.insert(categories).values(values).returning();
      if (!row) throw new Error("Category insert returned no row.");
      return row;
    },

    async update(id, patch) {
      const [row] = await db
        .update(categories)
        .set(patch)
        .where(eq(categories.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id) {
      const rows = await db
        .delete(categories)
        .where(eq(categories.id, id))
        .returning({ id: categories.id });
      return rows.length > 0;
    },

    async moveProductsAndDelete(fromId, toId) {
      await atomic(db, (q) => [
        q
          .update(products)
          .set({ categoryId: toId, updatedAt: new Date() })
          .where(eq(products.categoryId, fromId)),
        q.delete(categories).where(eq(categories.id, fromId)),
      ]);
    },
  };
}
