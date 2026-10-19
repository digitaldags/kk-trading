import type { ProductWithCategory } from "@/lib/domain/types";
import type { CategoryRepo, ProductRepo } from "@/lib/repositories/types";

export const MAX_SEARCH_LENGTH = 100;

export type StorefrontFilter = { categorySlug?: string; q?: string };

export function createCatalogService(deps: {
  products: ProductRepo;
  categories: CategoryRepo;
}) {
  return {
    /** Products for the storefront grid, filtered by category slug and search text. */
    async listForStorefront({
      categorySlug,
      q,
    }: StorefrontFilter = {}): Promise<ProductWithCategory[]> {
      let categoryId: string | undefined;
      if (categorySlug) {
        const category = await deps.categories.findBySlug(categorySlug);
        if (!category) return [];
        categoryId = category.id;
      }
      const query = q?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;
      return deps.products.listWithCategory({ categoryId, q: query });
    },

    getProductBySlug(slug: string): Promise<ProductWithCategory | null> {
      return deps.products.findBySlug(slug);
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
