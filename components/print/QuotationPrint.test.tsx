// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  CABINET_LINE,
  CHAIR_LINE,
  completedQuotation,
  TABLE_LINE,
} from "@/components/admin/testing/documents";
import type { QuotationWithItems } from "@/lib/domain/types";
import type { LetterheadSettings } from "./Letterhead";
import { QuotationPrint } from "./QuotationPrint";

// The owner's sample: 2 × 8,450 + 5 × 6,155 + 20 × 2,745 = ₱102,575.00.
const SAMPLE_ITEMS = [
  {
    ...CABINET_LINE,
    specs: "Powder coating finish\nSuperior gang drawer locking system",
    imageUrl:
      "https://example.public.blob.vercel-storage.com/products/cabinet.webp",
    unitPriceCentavos: 845000,
  },
  { ...TABLE_LINE, unitPriceCentavos: 615500 },
  { ...CHAIR_LINE, unitPriceCentavos: 274500 },
];

const SETTINGS: LetterheadSettings = {
  name: "KK TRADING",
  slogan: "FOUNDATION TO FURNISH",
  logoUrl: "https://example.public.blob.vercel-storage.com/branding/logo.png",
  phone: "+639 39 219 1060",
  phone2: "+639 77 698 2416",
};

function renderPrint(
  overrides: Partial<QuotationWithItems> = {},
  settings: Partial<LetterheadSettings> = {},
) {
  return render(
    <QuotationPrint
      quotation={completedQuotation({ items: SAMPLE_ITEMS, ...overrides })}
      settings={{ ...SETTINGS, ...settings }}
      icons={{ [TABLE_LINE.productId]: "table_restaurant" }}
    />,
  );
}

afterEach(cleanup);

describe("QuotationPrint", () => {
  it("prints the letterhead and title, without a DRAFT tag once completed", () => {
    const { container } = renderPrint();
    expect(screen.getByText("KK TRADING")).toBeVisible();
    expect(screen.getByText("FOUNDATION TO FURNISH")).toBeVisible();
    expect(
      screen.getByText("+639 39 219 1060 / +639 77 698 2416"),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /^QUOTATION$/,
    );
    const logo = container.querySelector("header img");
    expect(logo).toHaveAttribute("loading", "eager");
    expect(logo).toHaveAttribute("decoding", "sync");
  });

  it("tags a draft", () => {
    renderPrint({ status: "draft", completedAt: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "QUOTATIONDRAFT",
    );
  });

  it("closes up without a logo, and drops the slash without a second phone", () => {
    const { container } = renderPrint({}, { logoUrl: null, phone2: "" });
    expect(container.querySelector("header img")).toBeNull();
    expect(screen.getByText("+639 39 219 1060")).toBeVisible();
    expect(screen.queryByText(/\//)).toBeNull();
  });

  it("prints the meta grid in the sample's order", () => {
    renderPrint();
    const labels = [...document.querySelectorAll("dl dt")].map(
      (dt) => dt.textContent,
    );
    expect(labels.slice(0, 7)).toEqual([
      "Date",
      "No.",
      "Delivery Term",
      "Remarks",
      "Payment Terms",
      "Customer Information",
      "Delivery Address",
    ]);
    expect(screen.getByText("October 27, 2026")).toBeVisible();
    expect(screen.getByText("TIN: 123-456-789")).toBeVisible();
  });

  it("leaves out the TIN line when there's no TIN", () => {
    renderPrint({ customerTin: "" });
    expect(screen.queryByText(/^TIN:/)).toBeNull();
  });

  it("lists each line with its specs, prices and total, then the grand total", () => {
    renderPrint();
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Item Description", "UOM", "Qty", "Unit price", "Total price"]);

    const [cabinet, table2, chair] = within(table).getAllByRole("row").slice(1);
    expect(cabinet).toHaveTextContent("KK-DG-D4");
    expect(cabinet).toHaveTextContent("Superior gang drawer locking system");
    expect(
      within(cabinet!)
        .getAllByRole("cell")
        .slice(1)
        .map((c) => c.textContent),
    ).toEqual(["pcs", "2", "8,450.00", "16,900.00"]);
    expect(cabinet!.querySelector("img")).toHaveAttribute("loading", "eager");
    // No photo: the category icon, by product id.
    expect(table2).toHaveTextContent("table_restaurant");
    expect(chair).toHaveTextContent("54,900.00");

    expect(screen.getByText("GRAND TOTAL").nextSibling).toHaveTextContent(
      "₱102,575.00",
    );
  });

  it("prints Subtotal, Discounts, Tax rate and Sales tax blank", () => {
    renderPrint();
    for (const label of ["Subtotal", "Discounts", "Tax rate", "Sales tax"]) {
      expect(screen.getByText(label).nextSibling).toBeEmptyDOMElement();
    }
  });

  it("prints the remarks, acknowledgement and signature lines", () => {
    renderPrint();
    expect(screen.getByText("REMARKS")).toBeVisible();
    expect(screen.getByText("2 - 3 DAYS")).toBeVisible();
    expect(
      screen.getByText("*DELIVERY FEE IS EXCLUDED AND RATES MAY VARY"),
    ).toBeVisible();
    expect(screen.getByText("FORMAL QUOTATION ACKNOWLEDGEMENT")).toBeVisible();
    expect(screen.getByText("CLIENT NAME AND SIGNATURE:")).toBeVisible();
    expect(screen.getByText("DATE:")).toBeVisible();
    expect(screen.queryByText(/OPTIONALS/)).toBeNull();
  });
});
