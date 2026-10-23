import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, SETTINGS_TAG } from "@/lib/cacheTags";
import type { StorefrontFilter } from "@/lib/domain/schemas";
import { catalogService } from "@/lib/services";

// Cached reads for the storefront, all from the published snapshot (ticket 15). Publish
// and Discard in admin expire them through the tags. The hourly expiry only matters for
// changes made outside admin (e.g. the Neon console).

export async function getStoreSettings() {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");
  return catalogService.getSettings();
}

/** Categories in storefront order, with product counts. */
export async function getCategories() {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return catalogService.listCategories();
}

export async function getProducts(filter: StorefrontFilter) {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return catalogService.listForStorefront(filter);
}

/** One product with its category, or null when the slug is unknown or malformed. */
export async function getProduct(slug: string) {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return catalogService.getProductBySlug(slug);
}

/** For the footer. Cached for a day; `cacheComponents` doesn't allow `new Date()` in a render. */
export async function getCurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
