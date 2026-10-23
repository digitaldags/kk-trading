"use server";

import { refresh, updateTag } from "next/cache";
import type {
  ActionMessage,
  CategoryField,
  SaveCategoryInput,
  SaveResult,
} from "@/components/admin/actionTypes";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { CATALOG_TAG } from "@/lib/cacheTags";
import { CATEGORY_NOT_FOUND } from "@/lib/domain/schemas";
import { categoryService } from "@/lib/services";

// Every admin action starts with `await requireAdmin()` (see ../../actions-guard.test.ts).
// Categories feed the storefront's tiles, chips and nav, so each change expires the
// cached catalog with `updateTag`, and `refresh()` re-renders the admin list in place.

const products = (n: number) => `${n} ${n === 1 ? "product" : "products"}`;

export async function saveCategory(
  input: SaveCategoryInput,
): Promise<SaveResult<CategoryField>> {
  await requireAdmin();
  const { id, ...fields } = input;
  const result = id
    ? await categoryService.update(String(id), fields)
    : await categoryService.create(fields);
  if (!result.ok) {
    // A category deleted elsewhere drops out of the list.
    if (result.formError) refresh();
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

export async function deleteCategory(
  id: string,
  moveProductsTo?: string,
): Promise<ActionMessage> {
  await requireAdmin();
  const result = await categoryService.delete(String(id), {
    moveProductsTo: moveProductsTo ? String(moveProductsTo) : undefined,
  });
  // Refresh either way: the list may be out of date (a category gone, or counts changed).
  refresh();
  if (!result.ok) {
    const message =
      result.formError ??
      Object.values(result.fieldErrors)[0] ??
      CATEGORY_NOT_FOUND;
    return { ok: false, message };
  }
  updateTag(CATALOG_TAG);
  const { name, movedProducts, movedTo } = result.data;
  return {
    ok: true,
    message: movedTo
      ? `Deleted ${name}. Its ${products(movedProducts)} moved to ${movedTo}.`
      : `Deleted ${name}.`,
  };
}

export async function moveCategory(
  id: string,
  direction: "up" | "down",
): Promise<{ ok: true } | ActionMessage> {
  await requireAdmin();
  const result = await categoryService.move(
    String(id),
    direction === "down" ? "down" : "up",
  );
  refresh();
  if (!result.ok) {
    return { ok: false, message: result.formError ?? CATEGORY_NOT_FOUND };
  }
  if (result.data.moved) updateTag(CATALOG_TAG);
  return { ok: true };
}
