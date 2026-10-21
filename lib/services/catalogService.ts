import {
  storefrontFilterSchema,
  type StorefrontFilter,
} from "@/lib/domain/schemas";
import type { ProductWithCategory } from "@/lib/domain/types";
import type { CategoryRepo, ProductRepo } from "@/lib/repositories/types";

export type { StorefrontFilter };

export function createCatalogService(deps: {
  products: ProductRepo;
  categories: CategoryRepo;
}) {
  return {
    /**
     * Products for the storefront grid, filtered by category slug and search text.
     * The filter comes from the URL, so anything malformed is ignored rather than rejected.
     */
    async listForStorefront(
      filter: StorefrontFilter = {},
    ): Promise<ProductWithCategory[]> {
      const { categorySlug, q } = storefrontFilterSchema.parse(filter);
      let categoryId: string | undefined;
      if (categorySlug) {
        const category = await deps.categories.findBySlug(categorySlug);
        if (!category) return [];
        categoryId = category.id;
      }
      return deps.products.listWithCategory({ categoryId, q: q || undefined });
    },

    getProductBySlug(slug: string): Promise<ProductWithCategory | null> {
      return deps.products.findBySlug(slug);
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
