import type { ExportProduct } from "@/lib/domain/productImport";
import { STOCK_LABELS } from "@/lib/domain/stock";
import { createProductsWorkbook, workbookToBlob } from "./workbook";

/**
 * The whole catalog in the template's columns, one row per product, in the order given.
 * Every cell holds what the importer accepts, so an unchanged export imports as unchanged.
 */
export async function buildExport(
  products: ExportProduct[],
  categories: { name: string }[],
): Promise<Blob> {
  const { workbook, products: sheet } = await createProductsWorkbook(
    categories,
    products.length,
  );
  for (const product of products) {
    const { code, keySpec, description, specs, priceCentavos, stockStatus } =
      product;
    sheet.addRow({
      ...product,
      // Null, so a field with nothing in it is a truly empty cell.
      code: code || null,
      keySpec: keySpec || null,
      description: description || null,
      specs: specs || null,
      // A number, so Excel can sum the column. The sheet shows 2 decimals.
      price: priceCentavos / 100,
      stockStatus: STOCK_LABELS[stockStatus],
    });
  }
  return workbookToBlob(workbook);
}
