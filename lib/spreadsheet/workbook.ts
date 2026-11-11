import type { Workbook, Worksheet } from "exceljs";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  type ImportField,
} from "@/lib/domain/productImport";
import { STOCK_LABELS, STOCK_STATUSES } from "@/lib/domain/stock";
import { UOMS } from "@/lib/domain/uom";
import { loadExcelJs } from "./loadExcelJs";

// The sheets the template and the export share (ticket 42).

export const PRODUCTS_SHEET = "Products";
export const LISTS_SHEET = "Lists";
export const INSTRUCTIONS_SHEET = "Instructions";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const COLUMN_WIDTHS: Record<ImportField, number> = {
  code: 18,
  name: 34,
  category: 16,
  unit: 8,
  price: 14,
  stockStatus: 14,
  keySpec: 30,
  description: 44,
  specs: 44,
};

const STOCK_NAMES = STOCK_STATUSES.map((status) => STOCK_LABELS[status]);

/** `dataValidations` is on every worksheet, but missing from exceljs's types. */
type WithValidations = Worksheet & {
  dataValidations: {
    add(
      address: string,
      validation: { type: "list"; allowBlank: boolean; formulae: string[] },
    ): void;
  };
};

/** The column of the Products sheet, as a letter. */
const columnLetter = (key: ImportField) =>
  String.fromCharCode(
    "A".charCodeAt(0) + IMPORT_COLUMNS.findIndex((c) => c.key === key),
  );

/** One list on the Lists sheet, as a reference a dropdown can point at. */
function addList(
  sheet: Worksheet,
  column: number,
  title: string,
  items: string[],
) {
  sheet.getCell(1, column).value = title;
  items.forEach((item, index) => {
    sheet.getCell(index + 2, column).value = item;
  });
  const letter = String.fromCharCode("A".charCodeAt(0) + column - 1);
  const last = Math.max(items.length, 1) + 1;
  return `${LISTS_SHEET}!$${letter}$2:$${letter}$${last}`;
}

function addListsSheet(workbook: Workbook, categories: { name: string }[]) {
  const sheet = workbook.addWorksheet(LISTS_SHEET);
  sheet.columns = [{ width: 24 }, { width: 16 }, { width: 10 }];
  const references = {
    category: addList(
      sheet,
      1,
      "Category",
      categories.map((c) => c.name),
    ),
    stockStatus: addList(sheet, 2, "Stock status", STOCK_NAMES),
    unit: addList(sheet, 3, "Unit", [...UOMS]),
  };
  sheet.getRow(1).font = { bold: true };
  return references;
}

function addInstructionsSheet(workbook: Workbook) {
  const sheet = workbook.addWorksheet(INSTRUCTIONS_SHEET);
  sheet.columns = [{ width: 100, style: { alignment: { wrapText: true } } }];
  const lines = [
    "How to fill in the Products sheet",
    "Add one product per row. Row 1 is the header: keep all nine columns.",
    "Code: required, up to 40 characters. No two products can share a code.",
    "Name: required, up to 80 characters.",
    "Category: required. Use a name from the Lists sheet. An import never adds a category.",
    `Unit: required. Use ${UOMS.join(", ")}.`,
    "Price: required, in pesos, with at most 2 decimals: 8950, 8,950 or ₱8,950.50.",
    `Stock status: required. Use ${STOCK_NAMES.join(", ")}.`,
    "Key spec: optional, up to 90 characters.",
    "Description: optional, up to 600 characters.",
    "Specifications: optional, up to 1,000 characters in all. Put one spec on each line (Alt+Enter in Excel).",
    `Import up to ${MAX_IMPORT_ROWS} products at a time, in a file of up to 2 MB. Blank rows are skipped.`,
    "Existing products are skipped, and an import never changes them. Use the product editor to change one.",
    "Photos are added afterwards in the product editor.",
  ];
  lines.forEach((line, index) => {
    sheet.getCell(index + 1, 1).value = line;
  });
  sheet.getRow(1).font = { bold: true };
}

/**
 * A new workbook with the three sheets, ready for `dataRows` rows. Dropdowns reach
 * `MAX_IMPORT_ROWS` past them, so rows added under an export get them too.
 */
export async function createProductsWorkbook(
  categories: { name: string }[],
  dataRows = 0,
): Promise<{ workbook: Workbook; products: Worksheet }> {
  const { Workbook } = await loadExcelJs();
  const workbook = new Workbook();

  const products = workbook.addWorksheet(PRODUCTS_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  products.columns = IMPORT_COLUMNS.map(({ header, key }) => ({
    header,
    key,
    width: COLUMN_WIDTHS[key],
  }));
  // Text, so Excel keeps a code's leading zeros as it's typed.
  products.getColumn("code").numFmt = "@";
  products.getColumn("price").numFmt = "#,##0.00";
  for (const key of ["description", "specs"]) {
    products.getColumn(key).alignment = { wrapText: true, vertical: "top" };
  }
  products.getRow(1).font = { bold: true };

  const lists = addListsSheet(workbook, categories);
  const lastRow = 1 + dataRows + MAX_IMPORT_ROWS;
  for (const key of ["category", "unit", "stockStatus"] as const) {
    const letter = columnLetter(key);
    (products as WithValidations).dataValidations.add(
      `${letter}2:${letter}${lastRow}`,
      { type: "list", allowBlank: true, formulae: [lists[key]] },
    );
  }

  addInstructionsSheet(workbook);
  return { workbook, products };
}

export async function workbookToBlob(workbook: Workbook): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as unknown as BlobPart], { type: XLSX_TYPE });
}
