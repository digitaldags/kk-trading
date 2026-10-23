import type { Metadata } from "next";
import { ProductsAdmin } from "@/components/admin/ProductsAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { categoryService, productService } from "@/lib/services";
import { deleteProduct, discardUpload, saveProduct } from "./actions";

// Reads the session cookie, so it renders per request and blocks until it's checked.
export const instant = false;

export const metadata: Metadata = { title: "Products · Admin" };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * The products list (Figma 12:301), and the editor (12:509) when the URL has `?new=1`
 * or `?edit=<id>`, so a refresh keeps it open. Admin reads the database directly, never
 * the storefront's cached reads, so it always shows the latest saves.
 */
export default async function ProductsPage({
  searchParams,
}: PageProps<"/admin">) {
  const params = await searchParams;
  await requireAdmin();

  const q = first(params.q)?.trim() ?? "";
  const editId = first(params.edit);
  const adding = first(params.new) === "1";

  const [list, categories, editing] = await Promise.all([
    productService.listForAdmin({ q }),
    categoryService.list(),
    editId ? productService.get(editId) : null,
  ]);

  return (
    <ProductsAdmin
      {...list}
      categories={categories}
      q={q}
      editor={
        editing
          ? { mode: "edit", product: editing }
          : adding
            ? { mode: "add" }
            : null
      }
      missingProduct={Boolean(editId) && !editing}
      deleteAction={deleteProduct}
      saveAction={saveProduct}
      discardUploadAction={discardUpload}
    />
  );
}
