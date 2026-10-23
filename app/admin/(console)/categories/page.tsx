import type { Metadata } from "next";
import { CategoriesAdmin } from "@/components/admin/CategoriesAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { categoryService } from "@/lib/services";
import { deleteCategory, moveCategory, saveCategory } from "./actions";

// Reads the session cookie, so it renders per request and blocks until it's checked.
export const instant = false;

export const metadata: Metadata = { title: "Categories · Admin" };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * The categories list (Figma 12:968), and the editor (12:1030) when the URL has
 * `?new=1` or `?edit=<id>`. Reads the database directly, never the storefront's cache.
 */
export default async function CategoriesPage({
  searchParams,
}: PageProps<"/admin/categories">) {
  const params = await searchParams;
  await requireAdmin();

  const editId = first(params.edit);
  const adding = first(params.new) === "1";
  const categories = await categoryService.list();
  const editing = editId ? categories.find((c) => c.id === editId) : undefined;

  return (
    <CategoriesAdmin
      categories={categories}
      editor={
        editing
          ? { mode: "edit", category: editing }
          : adding
            ? { mode: "add" }
            : null
      }
      missingCategory={Boolean(editId) && !editing}
      saveAction={saveCategory}
      deleteAction={deleteCategory}
      moveAction={moveCategory}
    />
  );
}
