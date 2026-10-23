import { and, asc, eq, ilike, like, max, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { queryRows } from "@/lib/db/publish";
import { categories, products } from "@/lib/db/schema";
import { escapeLike } from "./like";
import type { ProductRepo } from "./types";

const productCategory = {
  id: categories.id,
  slug: categories.slug,
  name: categories.name,
  icon: categories.icon,
  sortOrder: categories.sortOrder,
};

export function createProductRepo(db: Db): ProductRepo {
  const selectWithCategory = () =>
    db
      .select({ product: products, category: productCategory })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id));

  return {
    async listWithCategory({ categoryId, q } = {}) {
      const conditions: (SQL | undefined)[] = [];
      if (categoryId) conditions.push(eq(products.categoryId, categoryId));
      if (q) {
        const pattern = `%${escapeLike(q)}%`;
        conditions.push(
          or(
            ilike(products.name, pattern),
            ilike(products.keySpec, pattern),
            ilike(products.description, pattern),
          ),
        );
      }
      const rows = await selectWithCategory()
        .where(and(...conditions))
        .orderBy(
          asc(categories.sortOrder),
          asc(products.sortOrder),
          asc(products.name),
        );
      return rows.map((r) => ({ ...r.product, category: r.category }));
    },

    async findById(id) {
      const [row] = await db.select().from(products).where(eq(products.id, id));
      return row ?? null;
    },

    async findBySlug(slug) {
      const [row] = await selectWithCategory().where(eq(products.slug, slug));
      return row ? { ...row.product, category: row.category } : null;
    },

    async slugsStartingWith(prefix) {
      const rows = await db
        .select({ slug: products.slug })
        .from(products)
        .where(like(products.slug, `${escapeLike(prefix)}%`));
      return rows.map((r) => r.slug);
    },

    async maxSortOrder() {
      const [row] = await db
        .select({ value: max(products.sortOrder) })
        .from(products);
      return row?.value ?? -1;
    },

    async insert(values) {
      const [row] = await db.insert(products).values(values).returning();
      if (!row) throw new Error("Product insert returned no row.");
      return row;
    },

    async update(id, patch) {
      const [row] = await db
        .update(products)
        .set(patch)
        .where(eq(products.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id) {
      const [row] = await db
        .delete(products)
        .where(eq(products.id, id))
        .returning();
      return row ?? null;
    },

    // The published snapshot counts too: until the next publish, the storefront still
    // shows a photo the draft has replaced or removed.
    async isImageInUse(url) {
      const [row] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.imageUrl, url))
        .limit(1);
      if (row) return true;
      const published = await queryRows(
        db,
        sql`
          select 1 from published_snapshot ps,
            jsonb_array_elements(ps.data->'products') p
          where ps.id = 1 and p->>'image_url' = ${url}
          limit 1
        `,
      );
      return published.length > 0;
    },
  };
}
