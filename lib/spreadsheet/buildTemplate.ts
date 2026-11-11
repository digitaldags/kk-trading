import { createProductsWorkbook, workbookToBlob } from "./workbook";

/**
 * The blank file the admin downloads. It has no example rows, because one left in by
 * mistake would import. `categories` fills the Lists sheet, so a template lists the
 * categories of the day it was downloaded.
 */
export async function buildTemplate(
  categories: { name: string }[],
): Promise<Blob> {
  const { workbook } = await createProductsWorkbook(categories);
  return workbookToBlob(workbook);
}
