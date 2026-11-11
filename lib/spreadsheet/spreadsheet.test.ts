import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS, type ExportProduct } from "@/lib/domain/productImport";
import { buildExport } from "./buildExport";
import { buildTemplate } from "./buildTemplate";
import { exportFileName, TEMPLATE_FILE_NAME } from "./fileNames";
import { cellText, MAX_FILE_BYTES, readProductsFile } from "./readProductsFile";

// Workbooks are built here with the same library, so these cover the real file format.

const HEADERS = IMPORT_COLUMNS.map((c) => c.header);
const CATEGORIES = [{ name: "Office" }, { name: "Gym" }];

const product = (overrides: Partial<ExportProduct> = {}): ExportProduct => ({
  code: "KK-001",
  name: "Mesh chair",
  category: "Office",
  unit: "pcs",
  priceCentavos: 895050,
  stockStatus: "low_stock",
  keySpec: "Breathable back",
  description: "A chair for long days.",
  specs: "Steel frame\nFive wheels\nLumbar support",
  ...overrides,
});

const dataRow = (code: unknown = "KK-001") => [
  code,
  "Mesh chair",
  "Office",
  "pcs",
  "8950",
  "In stock",
  "",
  "",
  "",
];

async function fileFrom(
  fill: (workbook: ExcelJS.Workbook) => void,
  name = "products.xlsx",
) {
  const workbook = new ExcelJS.Workbook();
  fill(workbook);
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer as unknown as BlobPart], name);
}

/** A `Products` sheet holding these rows, from row 1. */
const sheetFile = (rows: unknown[][], sheetName = "Products") =>
  fileFrom((workbook) => {
    workbook.addWorksheet(sheetName).addRows(rows);
  });

const fileOf = (blob: Blob, name = "products.xlsx") => new File([blob], name);

async function workbookOf(blob: Blob) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook;
}

describe("buildExport and readProductsFile", () => {
  it("gives back the rows that went in", async () => {
    const blob = await buildExport(
      [
        product(),
        product({ code: "", name: "No code", unit: "set", priceCentavos: 100 }),
        product({
          code: "0012",
          name: "Whole price",
          stockStatus: "in_stock",
          priceCentavos: 1999,
          keySpec: "",
          description: "",
          specs: "",
        }),
      ],
      CATEGORIES,
    );

    const result = await readProductsFile(fileOf(blob));

    expect(result).toEqual({
      ok: true,
      rowNumbers: [2, 3, 4],
      ignoredColumns: [],
      rows: [
        {
          code: "KK-001",
          name: "Mesh chair",
          category: "Office",
          unit: "pcs",
          price: "8950.5",
          stockStatus: "Low stock",
          keySpec: "Breathable back",
          description: "A chair for long days.",
          specs: "Steel frame\nFive wheels\nLumbar support",
        },
        {
          code: "",
          name: "No code",
          category: "Office",
          unit: "set",
          price: "1",
          stockStatus: "Low stock",
          keySpec: "Breathable back",
          description: "A chair for long days.",
          specs: "Steel frame\nFive wheels\nLumbar support",
        },
        {
          code: "0012",
          name: "Whole price",
          category: "Office",
          unit: "pcs",
          price: "19.99",
          stockStatus: "In stock",
          keySpec: "",
          description: "",
          specs: "",
        },
      ],
    });
  });

  it("writes the price as a number, and the sheets in order", async () => {
    const workbook = await workbookOf(
      await buildExport([product()], CATEGORIES),
    );
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      "Products",
      "Lists",
      "Instructions",
    ]);
    expect(workbook.getWorksheet("Products")!.getCell("E2").value).toBe(8950.5);
  });

  it("keeps every exact price through the file", async () => {
    const prices = [1, 7, 10, 99, 110, 1999, 2147483647];
    const blob = await buildExport(
      prices.map((priceCentavos, i) =>
        product({ code: `P-${i}`, priceCentavos }),
      ),
      CATEGORIES,
    );
    const result = await readProductsFile(fileOf(blob));
    if (!result.ok) throw new Error(result.error);
    expect(result.rows.map((r) => r.price)).toEqual([
      "0.01",
      "0.07",
      "0.1",
      "0.99",
      "1.1",
      "19.99",
      "21474836.47",
    ]);
  });
});

describe("buildTemplate", () => {
  it("reads as a file with no products", async () => {
    const blob = await buildTemplate(CATEGORIES);
    expect(await readProductsFile(fileOf(blob))).toEqual({
      ok: false,
      error: "The file has no products.",
    });
  });

  it("has a bold, frozen header, and a text Code column", async () => {
    const workbook = await workbookOf(await buildTemplate(CATEGORIES));
    const sheet = workbook.getWorksheet("Products")!;

    expect(sheet.getRow(1).values).toEqual([undefined, ...HEADERS]);
    expect(sheet.getCell("A1").font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.getColumn(1).numFmt).toBe("@");
    expect(sheet.rowCount).toBe(1);
  });

  it("lists today's categories, the stock labels and the units", async () => {
    const workbook = await workbookOf(await buildTemplate(CATEGORIES));
    const lists = workbook.getWorksheet("Lists")!;
    const column = (n: number) =>
      (lists.getColumn(n).values as unknown[]).filter(Boolean);

    expect(column(1)).toEqual(["Category", "Office", "Gym"]);
    expect(column(2)).toEqual([
      "Stock status",
      "In stock",
      "Low stock",
      "Out of stock",
    ]);
    expect(column(3)).toEqual(["Unit", "pcs", "set", "pair", "unit", "lot"]);
  });

  it("gives Category, Unit and Stock status dropdowns for the first 500 rows", async () => {
    const workbook = await workbookOf(await buildTemplate(CATEGORIES));
    const sheet = workbook.getWorksheet("Products") as ExcelJS.Worksheet & {
      dataValidations: { find(address: string): unknown };
    };

    for (const [column, formula] of [
      ["C", "Lists!$A$2:$A$3"],
      ["D", "Lists!$C$2:$C$6"],
      ["F", "Lists!$B$2:$B$4"],
    ]) {
      for (const row of [2, 501]) {
        expect(sheet.dataValidations.find(`${column}${row}`)).toMatchObject({
          type: "list",
          formulae: [formula],
        });
      }
      expect(sheet.dataValidations.find(`${column}502`)).toBeUndefined();
    }
  });

  it("still opens with no categories", async () => {
    const blob = await buildTemplate([]);
    expect(await readProductsFile(fileOf(blob))).toEqual({
      ok: false,
      error: "The file has no products.",
    });
  });

  it("explains the format last, and says existing products aren't changed", async () => {
    const workbook = await workbookOf(await buildTemplate(CATEGORIES));
    expect(workbook.worksheets.at(-1)?.name).toBe("Instructions");
    const text = (
      workbook.getWorksheet("Instructions")!.getColumn(1).values as unknown[]
    ).join("\n");
    for (const header of HEADERS) expect(text).toContain(`${header}:`);
    expect(text).toContain("500");
    expect(text).toContain("an import never changes them");
  });
});

describe("readProductsFile: columns", () => {
  it("matches headers ignoring case and surrounding spaces", async () => {
    const headers = HEADERS.map((h) => `  ${h.toUpperCase()} `);
    const result = await readProductsFile(
      await sheetFile([headers, dataRow()]),
    );
    expect(result).toMatchObject({ ok: true, rowNumbers: [2] });
  });

  it("finds columns in any order, and lists the ones it ignores", async () => {
    const result = await readProductsFile(
      await sheetFile([
        ["Notes", ...[...HEADERS].reverse()],
        ["Call first", ...dataRow().reverse()],
      ]),
    );
    expect(result).toMatchObject({
      ok: true,
      ignoredColumns: ["Notes"],
      rows: [{ code: "KK-001", name: "Mesh chair", price: "8950" }],
    });
  });

  it("names one missing column", async () => {
    const result = await readProductsFile(
      await sheetFile([HEADERS.slice(1), dataRow().slice(1)]),
    );
    expect(result).toEqual({
      ok: false,
      error: "Add the missing column: Code.",
    });
  });

  it("names several missing columns", async () => {
    const result = await readProductsFile(
      await sheetFile([HEADERS.slice(2), dataRow().slice(2)]),
    );
    expect(result).toEqual({
      ok: false,
      error: "Add the missing columns: Code, Name.",
    });
  });

  it("refuses a column that appears twice", async () => {
    const result = await readProductsFile(
      await sheetFile([[...HEADERS, "price "], dataRow()]),
    );
    expect(result).toEqual({
      ok: false,
      error: "The column “Price” appears more than once.",
    });
  });
});

describe("readProductsFile: sheets", () => {
  it("uses the Products sheet, ignoring case, wherever it is", async () => {
    const file = await fileFrom((workbook) => {
      workbook.addWorksheet("Notes").addRow(["Not this one"]);
      workbook.addWorksheet("PRODUCTS").addRows([HEADERS, dataRow()]);
    });
    expect((await readProductsFile(file)).ok).toBe(true);
  });

  it("falls back to the first sheet", async () => {
    const result = await readProductsFile(
      await sheetFile([HEADERS, dataRow()], "Sheet1"),
    );
    expect(result.ok).toBe(true);
  });

  it("refuses a file with no sheets", async () => {
    const file = await fileFrom(() => {});
    expect(await readProductsFile(file)).toEqual({
      ok: false,
      error: "The file has no sheets.",
    });
  });
});

describe("readProductsFile: cells", () => {
  it("turns a numeric code and a numeric price into strings", async () => {
    const row = dataRow(1001);
    row[4] = 8950.5;
    const result = await readProductsFile(await sheetFile([HEADERS, row]));
    expect(result).toMatchObject({
      ok: true,
      rows: [{ code: "1001", price: "8950.5" }],
    });
  });

  it("keeps a text price as typed", async () => {
    const row = dataRow();
    row[4] = "₱8,950.50";
    const result = await readProductsFile(await sheetFile([HEADERS, row]));
    expect(result).toMatchObject({ rows: [{ price: "₱8,950.50" }] });
  });

  it("keeps a price's float noise, for the server to refuse", async () => {
    const row = dataRow();
    row[4] = 0.1 + 0.2;
    const result = await readProductsFile(await sheetFile([HEADERS, row]));
    expect(result).toMatchObject({ rows: [{ price: "0.30000000000000004" }] });
  });

  it("reads a formula's cached value", async () => {
    const row = dataRow();
    row[4] = { formula: "1000*8.95", result: 8950 };
    const result = await readProductsFile(await sheetFile([HEADERS, row]));
    expect(result).toMatchObject({ rows: [{ price: "8950" }] });
  });

  it("gives an error cell's text, for the server to refuse", async () => {
    const row = dataRow();
    row[2] = { error: "#N/A" };
    row[4] = { formula: "1/0", result: { error: "#DIV/0!" } };
    const result = await readProductsFile(await sheetFile([HEADERS, row]));
    expect(result).toMatchObject({
      rows: [{ category: "#N/A", price: "#DIV/0!" }],
    });
  });

  it("reads rich text and hyperlinks as their text", async () => {
    const row = dataRow();
    row[1] = { richText: [{ text: "Mesh " }, { text: "chair" }] };
    row[6] = { text: "See the site", hyperlink: "https://example.com" };
    const result = await readProductsFile(await sheetFile([HEADERS, row]));
    expect(result).toMatchObject({
      rows: [{ name: "Mesh chair", keySpec: "See the site" }],
    });
  });

  it("gives dates and booleans as text", () => {
    expect(cellText(new Date("2026-11-06T00:00:00Z"))).toBe("2026-11-06");
    expect(cellText(true)).toBe("true");
  });

  it("trims text and keeps line breaks, in Excel's spellings too", async () => {
    const row = dataRow();
    row[1] = "  Mesh chair ";
    row[8] = "One\nTwo\r\nThree_x000D_\nFour";
    const result = await readProductsFile(await sheetFile([HEADERS, row]));
    expect(result).toMatchObject({
      rows: [{ name: "Mesh chair", specs: "One\nTwo\nThree\nFour" }],
    });
  });

  it("reads a merged range from its top-left cell only", async () => {
    const file = await fileFrom((workbook) => {
      const sheet = workbook.addWorksheet("Products");
      sheet.addRows([HEADERS, dataRow("A"), dataRow("B")]);
      sheet.mergeCells("B2:B3");
    });
    const result = await readProductsFile(file);
    expect(result).toMatchObject({
      rows: [{ name: "Mesh chair" }, { code: "B", name: "" }],
    });
  });

  it("skips blank rows, and keeps each row's Excel number", async () => {
    const result = await readProductsFile(
      await sheetFile([
        HEADERS,
        dataRow("A"),
        [],
        ["", "   "],
        dataRow("B"),
        [],
        dataRow("C"),
      ]),
    );
    expect(result).toMatchObject({ ok: true, rowNumbers: [2, 5, 7] });
  });

  it("keeps a row that looks wrong", async () => {
    const result = await readProductsFile(
      await sheetFile([HEADERS, ["", "", "Nowhere"]]),
    );
    expect(result).toMatchObject({
      ok: true,
      rows: [{ code: "", name: "", category: "Nowhere", price: "" }],
    });
  });
});

describe("readProductsFile: file checks", () => {
  it("takes up to 500 rows, and refuses 501", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => dataRow(`KK-${i}`));
    expect(
      (await readProductsFile(await sheetFile([HEADERS, ...rows]))).ok,
    ).toBe(true);

    rows.push(dataRow("KK-500"));
    expect(await readProductsFile(await sheetFile([HEADERS, ...rows]))).toEqual(
      {
        ok: false,
        error: "Import up to 500 products at a time. This file has 501.",
      },
    );
  });

  it("refuses a sheet with headers and no rows", async () => {
    expect(await readProductsFile(await sheetFile([HEADERS]))).toEqual({
      ok: false,
      error: "The file has no products.",
    });
  });

  it("accepts the extension in capitals", async () => {
    const file = await sheetFile([HEADERS, dataRow()]);
    const renamed = new File([file], "PRODUCTS.XLSX");
    expect((await readProductsFile(renamed)).ok).toBe(true);
  });

  it.each(["products.csv", "products.xls", "products", "products.xlsx.txt"])(
    "refuses %s before reading it",
    async (name) => {
      expect(await readProductsFile(new File(["a,b"], name))).toEqual({
        ok: false,
        error: "Choose an Excel file saved as .xlsx.",
      });
    },
  );

  it("refuses a file over 2 MB", async () => {
    const file = new File(
      [new Uint8Array(MAX_FILE_BYTES + 1)],
      "products.xlsx",
    );
    expect(await readProductsFile(file)).toEqual({
      ok: false,
      error: "The file is larger than 2 MB. Split it into smaller files.",
    });
  });

  it("refuses a corrupt file", async () => {
    const file = new File(["this is not a workbook"], "products.xlsx");
    expect(await readProductsFile(file)).toEqual({
      ok: false,
      error:
        "That file couldn't be read. Save it again as .xlsx and try once more.",
    });
  });
});

describe("file names", () => {
  it("names the template", () => {
    expect(TEMPLATE_FILE_NAME).toBe("kk-trading-products-template.xlsx");
  });

  it("dates the export in Manila", () => {
    expect(exportFileName(new Date("2026-11-06T18:00:00Z"))).toBe(
      "kk-trading-products-2026-11-07.xlsx",
    );
  });
});
