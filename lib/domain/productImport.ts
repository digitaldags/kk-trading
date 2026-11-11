import { STOCK_LABELS, STOCK_STATUSES, type StockStatus } from "./stock";
import { UOMS, type Uom } from "./uom";

// The Excel import and export (tickets 41 to 43). The browser reads the file and sends
// every cell as a string. This module has no server code, so both sides share it.

export const MAX_IMPORT_ROWS = 500;

/** The file's columns in order. The template, the export and the service all read this. */
export const IMPORT_COLUMNS = [
  { header: "Code", key: "code" },
  { header: "Name", key: "name" },
  { header: "Category", key: "category" },
  { header: "Unit", key: "unit" },
  { header: "Price", key: "price" },
  { header: "Stock status", key: "stockStatus" },
  { header: "Key spec", key: "keySpec" },
  { header: "Description", key: "description" },
  { header: "Specifications", key: "specs" },
] as const;

export type ImportField = (typeof IMPORT_COLUMNS)[number]["key"];

/** One data row, every cell a string. */
export type ImportRowInput = Record<ImportField, string>;

/** `rows.<index>.<field>`: `index` is the position in the array, not the Excel row. */
export type ImportErrorKey = `rows.${number}.${ImportField}`;

export type ImportPreviewRow = {
  index: number;
  code: string;
  name: string;
  outcome: "create" | "unchanged";
};

export type ImportPreview = {
  toCreate: number;
  unchanged: number;
  rows: ImportPreviewRow[];
};

export type ImportCommit = { created: number; unchanged: number };

/** One product as the export writes it. The action fills it; the browser builds the file. */
export type ExportProduct = {
  code: string;
  name: string;
  category: string;
  unit: Uom;
  priceCentavos: number;
  stockStatus: StockStatus;
  keySpec: string;
  description: string;
  specs: string;
};

/** What the browser needs to build the export: the rows, and the Lists sheet's names. */
export type ProductsExport = {
  products: ExportProduct[];
  categories: { name: string }[];
};

/** Trims, collapses whitespace and lower-cases, to match categories and codes. */
export function normalizeName(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Takes the label ("In stock") or the stored value ("in_stock"), ignoring case and spaces. */
export function parseStockStatus(text: string): StockStatus | null {
  const value = normalizeName(text);
  return (
    STOCK_STATUSES.find(
      (status) =>
        status === value || STOCK_LABELS[status].toLowerCase() === value,
    ) ?? null
  );
}

/** Takes a value from `UOMS`, ignoring case and surrounding spaces. */
export function parseUnit(text: string): Uom | null {
  const value = normalizeName(text);
  return UOMS.find((uom) => uom === value) ?? null;
}

/** "price", "price and stock status", "name, price and description". */
export function joinWords(words: string[]): string {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
