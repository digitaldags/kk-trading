import {
  isSlug,
  storefrontFilterSchema,
  type StorefrontFilter,
} from "@/lib/domain/schemas";
import type {
  CategoryWithCount,
  ProductWithCategory,
  StoreSettings,
} from "@/lib/domain/types";
import type { PublishRepo, PublishedStore } from "@/lib/repositories/types";

export type { StorefrontFilter };

const EMPTY: Omit<PublishedStore, "publishedAt"> = {
  categories: [],
  products: [],
  settings: null,
};

/**
 * What the storefront shows: always the published snapshot, never the admin's draft
 * (ticket 15). A small shop's catalog fits in memory, so filters run here, with the same
 * rules as the admin's SQL search.
 */
export function createCatalogService(deps: { published: PublishRepo }) {
  const store = async () => (await deps.published.getPublished()) ?? EMPTY;

  return {
    async getSettings(): Promise<StoreSettings> {
      const { settings } = await store();
      if (!settings) {
        throw new Error(
          "Nothing is published yet. Run `pnpm db:seed`, or publish from admin.",
        );
      }
      return settings;
    },

    /** Categories in storefront order, with how many published products each has. */
    async listCategories(): Promise<CategoryWithCount[]> {
      return (await store()).categories;
    },

    /**
     * Products for the storefront grid, filtered by category slug and search text (name,
     * key spec or description, ignoring case). The filter comes from the URL, so anything
     * malformed is ignored rather than rejected.
     */
    async listForStorefront(
      filter: StorefrontFilter = {},
    ): Promise<ProductWithCategory[]> {
      const { categorySlug, q } = storefrontFilterSchema.parse(filter);
      const { products } = await store();
      const needle = q?.toLowerCase();
      return products.filter(
        (p) =>
          (!categorySlug || p.category.slug === categorySlug) &&
          (!needle ||
            [p.name, p.keySpec, p.description].some((text) =>
              text.toLowerCase().includes(needle),
            )),
      );
    },

    /** The slug comes from the URL; a malformed one is not found rather than looked up. */
    async getProductBySlug(slug: string): Promise<ProductWithCategory | null> {
      if (!isSlug(slug)) return null;
      return (await store()).products.find((p) => p.slug === slug) ?? null;
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
