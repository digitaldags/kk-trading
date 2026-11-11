import { describe, expect, it } from "vitest";
import {
  IMPORT_COLUMNS,
  joinWords,
  normalizeName,
  parseStockStatus,
  parseUnit,
} from "./productImport";

describe("IMPORT_COLUMNS", () => {
  it("lists the nine headers in the file's order", () => {
    expect(IMPORT_COLUMNS.map((c) => c.header)).toEqual([
      "Code",
      "Name",
      "Category",
      "Unit",
      "Price",
      "Stock status",
      "Key spec",
      "Description",
      "Specifications",
    ]);
  });
});

describe("normalizeName", () => {
  it("trims, collapses whitespace and lower-cases", () => {
    expect(normalizeName("  Home   OFFICE\t")).toBe("home office");
  });
});

describe("parseStockStatus", () => {
  it.each([
    ["In stock", "in_stock"],
    ["  LOW   stock ", "low_stock"],
    ["Out of stock", "out_of_stock"],
    ["in_stock", "in_stock"],
    ["OUT_OF_STOCK", "out_of_stock"],
  ])("reads %j", (text, status) => {
    expect(parseStockStatus(text)).toBe(status);
  });

  it.each(["", "   ", "Available", "instock"])("refuses %j", (text) => {
    expect(parseStockStatus(text)).toBeNull();
  });
});

describe("parseUnit", () => {
  it.each([
    ["pcs", "pcs"],
    [" SET ", "set"],
    ["Pair", "pair"],
    ["unit", "unit"],
    ["LOT", "lot"],
  ])("reads %j", (text, unit) => {
    expect(parseUnit(text)).toBe(unit);
  });

  it.each(["", "piece", "pieces", "box"])("refuses %j", (text) => {
    expect(parseUnit(text)).toBeNull();
  });
});

describe("joinWords", () => {
  it.each([
    [[], ""],
    [["price"], "price"],
    [["price", "stock status"], "price and stock status"],
    [["name", "price", "description"], "name, price and description"],
  ])("joins %j", (words, text) => {
    expect(joinWords(words)).toBe(text);
  });
});
