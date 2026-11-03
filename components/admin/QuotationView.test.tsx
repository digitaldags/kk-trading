// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import type { CreateReceiptAction, DeleteReceiptAction } from "./actionTypes";
import { QuotationView, type QuotationViewProps } from "./QuotationView";
import {
  CABINET_LINE,
  CHAIR_LINE,
  completedQuotation,
  QUOTATION_ID,
  receipt,
  receiptDefaults,
  TABLE_LINE,
} from "./testing/documents";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

let createReceiptAction: ReturnType<typeof vi.fn<CreateReceiptAction>>;
let deleteReceiptAction: ReturnType<typeof vi.fn<DeleteReceiptAction>>;

function props(
  overrides: Partial<QuotationViewProps> = {},
): QuotationViewProps {
  return {
    quotation: completedQuotation(),
    receiptDefaults: receiptDefaults(),
    receipts: [],
    createReceiptAction,
    deleteReceiptAction,
    ...overrides,
  };
}

function renderView(overrides: Partial<QuotationViewProps> = {}) {
  const view = (p: Partial<QuotationViewProps>) => (
    <SnackbarProvider>
      <QuotationView {...props(p)} />
    </SnackbarProvider>
  );
  const result = render(view(overrides));
  return {
    rerender: (next: Partial<QuotationViewProps>) =>
      result.rerender(view(next)),
  };
}

const createButton = () =>
  screen.queryByRole("button", { name: "Create delivery receipt" });

beforeEach(() => {
  refresh.mockReset();
  createReceiptAction = vi.fn<CreateReceiptAction>();
  deleteReceiptAction = vi.fn<DeleteReceiptAction>();
});

afterEach(cleanup);

describe("QuotationView: completed", () => {
  it("shows the header, the summary and what is left to deliver", () => {
    renderView();
    expect(
      screen.getByRole("heading", { level: 1, name: "2026-1027-NORTHWIND" }),
    ).toBeVisible();
    expect(
      screen.getByText("Quotation · Completed Oct 28, 2026"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Completed quotations are read-only. 27 pcs are still to be delivered.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Print quotation" }),
    ).toHaveAttribute("href", `/admin/print/quotations/${QUOTATION_ID}`);
    expect(createButton()).toBeVisible();

    const summary = within(screen.getByRole("region", { name: "Summary" }));
    expect(summary.getByText("Northwind")).toBeVisible();
    expect(summary.getByText("123-456-789")).toBeVisible();
    // 27 lines at ₱1,000.00 each.
    expect(summary.getByText("₱27,000.00")).toBeVisible();
    expect(summary.getByText("ARRANGED BY BUYER")).toBeVisible();
  });

  it("writes what is left per unit when the lines use different units", () => {
    const sets = { ...TABLE_LINE, uom: "set" as const };
    renderView({
      quotation: completedQuotation({
        items: [CABINET_LINE, sets, CHAIR_LINE],
      }),
      receiptDefaults: receiptDefaults([2, 3, 12], {}, [
        CABINET_LINE,
        sets,
        CHAIR_LINE,
      ]),
    });
    expect(
      screen.getByText(
        "Completed quotations are read-only. 2 sets and 8 pcs are still to be delivered.",
      ),
    ).toBeVisible();
  });

  it("lists ordered, delivered and remaining per line", () => {
    renderView({ receiptDefaults: receiptDefaults([2, 5, 12]) });
    const table = within(
      screen.getByRole("region", { name: "Delivery progress" }),
    );
    const chair = table.getByRole("row", { name: /KK-YS 948/ });
    expect(
      within(chair)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "KK-YS 948 · Mesh office chair",
      "UOM pcs",
      "Ordered 20",
      "Delivered 12",
      "Remaining 8",
    ]);
  });

  it("says everything has been delivered, and hides Create", () => {
    renderView({ receiptDefaults: receiptDefaults([2, 5, 20]) });
    expect(
      screen.getByText(
        "Completed quotations are read-only. Everything has been delivered.",
      ),
    ).toBeVisible();
    expect(createButton()).toBeNull();
  });

  it("lists the receipts with their items, and says when there are none", () => {
    const { rerender } = renderView();
    expect(screen.getByText("No delivery receipts yet.")).toBeVisible();

    rerender({
      receipts: [
        receipt(1, "DR-1", [
          [CABINET_LINE, 2],
          [TABLE_LINE, 5],
          [CHAIR_LINE, 12],
        ]),
      ],
    });
    const list = within(
      screen.getByRole("region", { name: "Delivery receipts" }),
    );
    const row = list.getByRole("row", { name: /DR-1/ });
    expect(row).toHaveTextContent(
      "2 × KK-DG-D4, 5 × KK-GF-Z014, 12 × KK-YS 948",
    );
    expect(row).toHaveTextContent("Oct 28, 2026");
    expect(within(row).getByRole("link", { name: "Print" })).toHaveAttribute(
      "href",
      "/admin/print/receipts/00000000-0000-4000-8000-0000000000f1",
    );
  });

  it("asks before deleting a receipt, then refreshes", async () => {
    const dr = receipt(1, "DR-1", [[CHAIR_LINE, 12]]);
    deleteReceiptAction.mockResolvedValue({
      ok: true,
      message: "Deleted receipt DR-1.",
    });
    const { rerender } = renderView({ receipts: [dr] });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete receipt DR-1" }),
    );
    const dialog = within(
      screen.getByRole("dialog", { name: "Delete receipt DR-1?" }),
    );
    expect(
      dialog.getByText("Its quantities count as not delivered again."),
    ).toBeVisible();
    await act(async () => {
      fireEvent.click(dialog.getByRole("button", { name: "Delete receipt" }));
    });

    expect(deleteReceiptAction).toHaveBeenCalledWith(dr.id);
    expect(refresh).toHaveBeenCalled();
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(
      "Deleted receipt DR-1.",
    );

    // The row is gone after the refresh: focus moves to the receipts panel.
    (document.activeElement as HTMLElement | null)?.blur();
    rerender({ receipts: [] });
    expect(
      screen.getByRole("heading", { name: "Delivery receipts" }),
    ).toHaveFocus();
  });

  it("cancels a delete without calling the action", () => {
    renderView({ receipts: [receipt(1, "DR-1", [[CHAIR_LINE, 1]])] });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete receipt DR-1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteReceiptAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens Create delivery receipt", () => {
    renderView();
    fireEvent.click(createButton()!);
    expect(
      screen.getByRole("dialog", { name: "Create delivery receipt" }),
    ).toBeVisible();
  });
});

describe("QuotationView: declined", () => {
  it("shows no progress, no receipts and no Create button", () => {
    renderView({
      quotation: completedQuotation({
        status: "declined",
        completedAt: null,
        declinedAt: new Date("2026-10-29T02:00:00Z"),
      }),
      receiptDefaults: null,
    });
    expect(screen.getByText("Quotation · Declined Oct 29, 2026")).toBeVisible();
    expect(
      screen.getByText("This quotation was declined and is read-only."),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Delivery progress" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Delivery receipts" }),
    ).toBeNull();
    expect(createButton()).toBeNull();
    expect(screen.getByRole("link", { name: "Print quotation" })).toBeVisible();
  });
});
