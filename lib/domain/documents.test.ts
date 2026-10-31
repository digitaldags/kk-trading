import { describe, expect, it } from "vitest";
import { formatPesoExact } from "@/lib/format";
import {
  countWithUom,
  deliveryState,
  deliveryStateLabel,
  documentToday,
  grandTotal,
  lineTotal,
  phoneLine,
  QUOTATION_STATUS_LABELS,
  receiptItemsSummary,
  remainingByUom,
} from "./documents";

// The sample quotation: 2 × 8,450 + 5 × 6,155 + 20 × 2,745.
const sample = [
  { quantity: 2, unitPriceCentavos: 845000 },
  { quantity: 5, unitPriceCentavos: 615500 },
  { quantity: 20, unitPriceCentavos: 274500 },
];

describe("totals", () => {
  it("multiplies quantity by unit price", () => {
    expect(sample.map(lineTotal)).toEqual([1690000, 3077500, 5490000]);
  });

  it("sums the sample to ₱102,575.00", () => {
    expect(grandTotal(sample)).toBe(10257500);
    expect(formatPesoExact(grandTotal(sample))).toBe("₱102,575.00");
  });

  it("is 0 with no lines", () => {
    expect(grandTotal([])).toBe(0);
  });

  it("throws rather than lose precision", () => {
    const huge = { quantity: 2 ** 30, unitPriceCentavos: 2 ** 30 };
    expect(() => lineTotal(huge)).toThrow(RangeError);
    const big = { quantity: 1, unitPriceCentavos: Number.MAX_SAFE_INTEGER };
    expect(() => grandTotal([big, big])).toThrow(RangeError);
  });
});

describe("deliveryState", () => {
  it.each([
    [10, 0, "none"],
    [10, 4, "partial"],
    [10, 10, "full"],
    [0, 0, "none"],
  ] as const)("ordered %i, delivered %i is %s", (ordered, delivered, state) => {
    expect(deliveryState(ordered, delivered)).toBe(state);
  });

  it("labels completed quotations and dashes the others", () => {
    expect(deliveryStateLabel("completed", "none")).toBe("Not delivered");
    expect(deliveryStateLabel("completed", "partial")).toBe("Partly delivered");
    expect(deliveryStateLabel("completed", "full")).toBe("Fully delivered");
    expect(deliveryStateLabel("draft", "none")).toBe("—");
    expect(deliveryStateLabel("declined", "none")).toBe("—");
  });

  it("labels the statuses", () => {
    expect(QUOTATION_STATUS_LABELS).toEqual({
      draft: "Draft",
      completed: "Completed",
      declined: "Declined",
    });
  });
});

describe("documentToday", () => {
  it("is the date in Manila, not UTC", () => {
    // 23:30 UTC on the 27th is 07:30 on the 28th in Manila (UTC+8).
    expect(documentToday(new Date("2026-10-27T23:30:00Z"))).toBe("2026-10-28");
    expect(documentToday(new Date("2026-10-27T15:59:00Z"))).toBe("2026-10-27");
  });
});

describe("remainingByUom", () => {
  it("sums what is left per unit, in line order, skipping lines with nothing left", () => {
    expect(
      remainingByUom([
        { uom: "pcs", remaining: 3 },
        { uom: "set", remaining: 2 },
        { uom: "pcs", remaining: 5 },
        { uom: "pair", remaining: 0 },
      ]),
    ).toBe("8 pcs and 2 sets");
  });

  it("lists three or more units with commas", () => {
    expect(
      remainingByUom([
        { uom: "pcs", remaining: 8 },
        { uom: "set", remaining: 2 },
        { uom: "pair", remaining: 1 },
      ]),
    ).toBe("8 pcs, 2 sets and 1 pair");
  });

  it("is empty when everything has been delivered", () => {
    expect(remainingByUom([{ uom: "pcs", remaining: 0 }])).toBe("");
    expect(remainingByUom([])).toBe("");
  });

  it("keeps pcs as it is and adds an s to the other units", () => {
    expect(countWithUom(1, "pcs")).toBe("1 pcs");
    expect(countWithUom(1, "set")).toBe("1 set");
    expect(countWithUom(3, "unit")).toBe("3 units");
  });
});

describe("receiptItemsSummary", () => {
  it("lists quantity × code, or the name when there is no code", () => {
    expect(
      receiptItemsSummary([
        { quantity: 2, line: { code: "KK-DG-D4", name: "Cabinet" } },
        { quantity: 12, line: { code: "", name: "Adjustable bench" } },
      ]),
    ).toBe("2 × KK-DG-D4, 12 × Adjustable bench");
  });
});

describe("phoneLine", () => {
  it("joins both phones with a slash, or shows the one that is set", () => {
    expect(phoneLine("+639 39 219 1060", "+639 77 698 2416")).toBe(
      "+639 39 219 1060 / +639 77 698 2416",
    );
    expect(phoneLine("+639 39 219 1060", "")).toBe("+639 39 219 1060");
    expect(phoneLine("", " +639 77 698 2416 ")).toBe("+639 77 698 2416");
    expect(phoneLine("", "")).toBe("");
  });
});
