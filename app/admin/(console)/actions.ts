"use server";

import { refresh, updateTag } from "next/cache";
import type {
  ActionMessage,
  SaveProductInput,
  SaveProductResult,
} from "@/components/admin/actionTypes";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { CATALOG_TAG, SETTINGS_TAG } from "@/lib/cacheTags";
import { PRODUCT_NOT_FOUND } from "@/lib/domain/schemas";
import { productService, publishService } from "@/lib/services";
import { NOTHING_PUBLISHED } from "@/lib/services/publishService";

// Every admin action starts with `await requireAdmin()` (see ../actions-guard.test.ts).
// Saves change the draft only (ticket 15): the storefront shows the published copy until
// `publish()`. `refresh()` re-renders the admin list and the app bar's status in place.

export async function deleteProduct(id: string): Promise<ActionMessage> {
  await requireAdmin();
  const result = await productService.delete(String(id));
  // Refresh either way: a product that was already gone drops out of the list too.
  refresh();
  if (!result.ok) {
    return { ok: false, message: result.formError ?? PRODUCT_NOT_FOUND };
  }
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
  refresh();
  const { name } = result.data;
  return { ok: true, message: id ? `Saved ${name}.` : `Added ${name}.` };
}

/** A photo uploaded for a save that never happened (the editor was closed after an error). */
export async function discardUpload(url: string): Promise<void> {
  await requireAdmin();
  await productService.discardUnusedImage(String(url));
}

/** Makes the draft live: the storefront's cached reads expire, so `/` shows it next load. */
export async function publish(): Promise<ActionMessage> {
  await requireAdmin();
  await publishService.publish();
  updateTag(CATALOG_TAG);
  updateTag(SETTINGS_TAG);
  refresh();
  return { ok: true, message: "Your changes are live." };
}

/** Puts the draft back to what's live. The storefront doesn't change. */
export async function discardChanges(): Promise<ActionMessage> {
  await requireAdmin();
  const discarded = await publishService.discard();
  refresh();
  return discarded
    ? { ok: true, message: "Changes discarded." }
    : { ok: false, message: NOTHING_PUBLISHED };
}
