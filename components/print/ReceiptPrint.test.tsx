// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  CABINET_LINE,
  CHAIR_LINE,
  completedQuotation,
  receipt,
} from "@/components/admin/testing/documents";
import { INPUT_TAX_NOTICE } from "@/lib/domain/documents";
import { ReceiptPrint } from "./ReceiptPrint";

const SETTINGS = {
  name: "KK TRADING",
  slogan: "FOUNDATION TO FURNISH",
  logoUrl: null,
  phone: "+639 39 219 1060",
  phone2: "",
};

function renderReceipt() {
  const dr = {
    ...receipt(1, "DR-2026-001", [
      [CABINET_LINE, 1],
      [CHAIR_LINE, 12],
    ]),
    deliveryAddress: "Lapu-Lapu City, Cebu",
  };
  return render(
    <ReceiptPrint
      receipt={dr}
      quotation={completedQuotation()}
      settings={SETTINGS}
      icons={{}}
    />,
  );
}

afterEach(cleanup);

describe("ReceiptPrint", () => {
  it("prints the title, number, date, customer and the receipt's address", () => {
    renderReceipt();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /^DELIVERY RECEIPT$/,
    );
    expect(screen.getByText("DR-2026-001")).toBeVisible();
    expect(screen.getByText("October 28, 2026")).toBeVisible();
    expect(screen.getByText("Northwind")).toBeVisible();
    expect(screen.getByText("TIN: 123-456-789")).toBeVisible();
    expect(screen.getByText("Lapu-Lapu City, Cebu")).toBeVisible();
  });

  it("lists only this receipt's lines and quantities, without prices", () => {
    renderReceipt();
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Item Description", "UOM", "Qty"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole("cell")
          .slice(1)
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ["pcs", "1"],
      ["pcs", "12"],
    ]);
    expect(screen.queryByText(/Unit price|GRAND TOTAL/)).toBeNull();
  });

  it("prints the input-tax notice and the three signature lines", () => {
    renderReceipt();
    expect(screen.getByText(INPUT_TAX_NOTICE)).toBeVisible();
    expect(screen.getByText("PREPARED BY:")).toBeVisible();
    expect(screen.getByText("RECEIVED BY:")).toBeVisible();
    expect(screen.getAllByText("NAME AND SIGNATURE")).toHaveLength(2);
    expect(screen.getByText("DATE:")).toBeVisible();
  });
});
