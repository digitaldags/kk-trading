import type { Cell, Row, Worksheet } from "exceljs";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  type ImportField,
  type ImportRowInput,
} from "@/lib/domain/productImport";
import { loadExcelJs } from "./loadExcelJs";
import { PRODUCTS_SHEET } from "./workbook";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ReadResult =
  | {
      ok: true;
      rows: ImportRowInput[];
      /** `rowNumbers[i]` is the Excel row of `rows[i]`. The first data row is 2. */
      rowNumbers: number[];
      ignoredColumns: string[];
    }
  | { ok: false; error: string };

const fail = (error: string): ReadResult => ({ ok: false, error });

/** Excel writes a carriage return as `_x000D_`, and a stored description has only `\n`. */
const cleanText = (text: string) =>
  text
    .replace(/_x000D_/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();

/**
 * Any cell value as text. It reads the value, never the display text: the server decides
 * whether a price is valid, so a number's noise must reach it (ticket 42).
 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "object") return "";

  if ("richText" in value && Array.isArray(value.richText)) {
    const parts = value.richText as { text?: unknown }[];
    return cleanText(parts.map((part) => String(part.text ?? "")).join(""));
  }
  if ("error" in value) return cellText(value.error);
  // A formula's cached value.
  if ("result" in value) return cellText(value.result);
  // A hyperlink's text, which can itself be rich text.
  if ("text" in value) return cellText(value.text);
  return "";
}

/** Only the top-left cell of a merge has a value. exceljs repeats it on the others. */
const textOf = (cell: Cell) =>
  cell.master.address === cell.address ? cellText(cell.value) : "";

const COLUMN_BY_HEADER = new Map(
  IMPORT_COLUMNS.map((column) => [column.header.toLowerCase(), column]),
);

/** Which sheet column holds each field, and what isn't ours. */
function readHeader(sheet: Worksheet) {
  const columns = new Map<ImportField, number>();
  const ignoredColumns: string[] = [];
  let repeated: string | undefined;

  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = textOf(cell);
    if (!header) return;
    const column = COLUMN_BY_HEADER.get(header.toLowerCase());
    if (!column) {
      ignoredColumns.push(header);
    } else if (columns.has(column.key)) {
      repeated ??= column.header;
    } else {
      columns.set(column.key, columnNumber);
    }
  });

  return { columns, ignoredColumns, repeated };
}

const isBlank = (row: Row) => {
  let blank = true;
  row.eachCell((cell) => {
    if (textOf(cell)) blank = false;
  });
  return blank;
};

/**
 * Turns an `.xlsx` into plain string rows, in the browser. A row that merely looks wrong
 * is kept: the server reports it. Only a file that can't be read as rows stops here, and
 * then nothing goes to the server.
 */
export async function readProductsFile(file: File): Promise<ReadResult> {
  if (!/\.xlsx$/i.test(file.name)) {
    return fail("Choose an Excel file saved as .xlsx.");
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail("The file is larger than 2 MB. Split it into smaller files.");
  }

  const { Workbook } = await loadExcelJs();
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return fail(
      "That file couldn't be read. Save it again as .xlsx and try once more.",
    );
  }

  const sheet =
    workbook.worksheets.find(
      (s) => s.name.trim().toLowerCase() === PRODUCTS_SHEET.toLowerCase(),
    ) ?? workbook.worksheets[0];
  if (!sheet) return fail("The file has no sheets.");

  const { columns, ignoredColumns, repeated } = readHeader(sheet);
  const missing = IMPORT_COLUMNS.filter((c) => !columns.has(c.key)).map(
    (c) => c.header,
  );
  if (missing.length > 0) {
    const noun = missing.length === 1 ? "column" : "columns";
    return fail(`Add the missing ${noun}: ${missing.join(", ")}.`);
  }
  if (repeated) return fail(`The column “${repeated}” appears more than once.`);

  const rows: ImportRowInput[] = [];
  const rowNumbers: number[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || isBlank(row)) return;
    const entries = IMPORT_COLUMNS.map(({ key }) => [
      key,
      textOf(row.getCell(columns.get(key) as number)),
    ]);
    rows.push(Object.fromEntries(entries) as ImportRowInput);
    rowNumbers.push(rowNumber);
  });

  if (rows.length > MAX_IMPORT_ROWS) {
    return fail(
      `Import up to ${MAX_IMPORT_ROWS} products at a time. This file has ${rows.length}.`,
    );
  }
  if (rows.length === 0) return fail("The file has no products.");

  return { ok: true, rows, rowNumbers, ignoredColumns };
}
