import { getCategories, getProduct, getStoreSettings } from "./storefront";

/**
 * Everything the product page and the product dialog show, from the cached reads.
 * Null when there's no product with this slug.
 */
export async function getProductDetail(slug: string) {
  const [product, categories, settings] = await Promise.all([
    getProduct(slug),
    getCategories(),
    getStoreSettings(),
  ]);
  if (!product) return null;

  // Tones follow the category's position, so the photo placeholder matches its tile.
  const toneIndex = Math.max(
    0,
    categories.findIndex((c) => c.id === product.categoryId),
  );
  return { product, toneIndex, categories, settings };
}
