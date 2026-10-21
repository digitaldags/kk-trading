"use server";

import { refresh, updateTag } from "next/cache";
import type {
  ActionMessage,
  SaveProductInput,
  SaveProductResult,
} from "@/components/admin/actionTypes";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { CATALOG_TAG } from "@/lib/cacheTags";
import { PRODUCT_NOT_FOUND } from "@/lib/domain/schemas";
import { productService } from "@/lib/services";

// Every admin action starts with `await requireAdmin()` (see ../actions-guard.test.ts).
// Saves go live right away: `updateTag` expires the storefront's cached catalog, and
// `refresh()` re-renders the admin list in place.

export async function deleteProduct(id: string): Promise<ActionMessage> {
  await requireAdmin();
  const result = await productService.delete(String(id));
  // Refresh either way: a product that was already gone drops out of the list too.
  refresh();
  if (!result.ok) {
    return { ok: false, message: result.formError ?? PRODUCT_NOT_FOUND };
  }
  updateTag(CATALOG_TAG);
  return { ok: true, message: `Deleted ${result.data.name}.` };
}

export async function saveProduct(
  input: SaveProductInput,
): Promise<SaveProductResult> {
  await requireAdmin();
  const { id, ...fields } = input;
  const result = id
    ? await productService.update(String(id), fields)
    : await productService.create(fields);
  if (!result.ok) {
    return {
      ok: false,
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }
  updateTag(CATALOG_TAG);
  refresh();
  const { name } = result.data;
  return { ok: true, message: id ? `Saved ${name}.` : `Added ${name}.` };
}

/** A photo uploaded for a save that never happened (the editor was closed after an error). */
export async function discardUpload(url: string): Promise<void> {
  await requireAdmin();
  await productService.discardUnusedImage(String(url));
}
