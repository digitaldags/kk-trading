import type { ProductWithCategory } from "@/lib/domain/types";

/** Category icon by product id, for printed lines without a photo. */
export function categoryIcons(
  products: ProductWithCategory[],
): Record<string, string> {
  return Object.fromEntries(products.map((p) => [p.id, p.category.icon]));
}
