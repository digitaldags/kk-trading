import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, SETTINGS_TAG } from "@/lib/cacheTags";
import type { StorefrontFilter } from "@/lib/domain/schemas";
import {
  catalogService,
  categoryService,
  settingsService,
} from "@/lib/services";

// Cached reads for the storefront. Admin saves expire them through the tags.
// The hourly expiry only matters for edits made outside admin (e.g. the Neon console).

export async function getStoreSettings() {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");
  return settingsService.get();
}

/** Categories in storefront order, with product counts. */
export async function getCategories() {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return categoryService.list();
}

export async function getProducts(filter: StorefrontFilter) {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return catalogService.listForStorefront(filter);
}

/** For the footer. Cached for a day; `cacheComponents` doesn't allow `new Date()` in a render. */
export async function getCurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
