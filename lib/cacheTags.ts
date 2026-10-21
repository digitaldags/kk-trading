// Cache tags for the storefront's cached reads (app/_data/storefront.ts).
// Admin server actions call `updateTag(tag)` after a save so the next load shows it.

/** Products and categories. */
export const CATALOG_TAG = "catalog";

/** Store name, hero copy and contact details. */
export const SETTINGS_TAG = "settings";
