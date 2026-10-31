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
import { DocumentStatus } from "@/components/ui/DocumentStatus";
import type { QuotationSummary } from "@/lib/domain/types";
import { DocumentsAdmin, type DocumentsAdminProps } from "./DocumentsAdmin";
import { SEARCH_DEBOUNCE_MS } from "./ProductsAdmin";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const summary = (
  overrides: Partial<QuotationSummary> = {},
): QuotationSummary => ({
  id: "00000000-0000-4000-8000-0000000000a1",
  number: "2026-1027-NORTHWIND-4-KNOCK",
  status: "completed",
  quoteDate: "2026-10-27",
  customerName: "Northwind Components Philippines Inc.",
  updatedAt: new Date("2026-10-27T00:00:00Z"),
  itemCount: 3,
  grandTotalCentavos: 10257500,
  deliveryState: "partial",
  ...overrides,
});

const DRAFT = summary({
  id: "00000000-0000-4000-8000-0000000000a2",
  number: "2026-1028-BAYVIEW-1-KNOCK",
  status: "draft",
  customerName: "Bayview Fitness Studio",
  quoteDate: "2026-10-28",
  grandTotalCentavos: 8640000,
  deliveryState: "none",
});
const PARTLY = summary();
const FULLY = summary({
  id: "00000000-0000-4000-8000-0000000000a3",
  number: "2026-1027-NORTHWIND-3-KNOCK",
  deliveryState: "full",
});
const NOT_DELIVERED = summary({
  id: "00000000-0000-4000-8000-0000000000a4",
  number: "2026-1026-ACME-1",
  deliveryState: "none",
});
const DECLINED = summary({
  id: "00000000-0000-4000-8000-0000000000a5",
  number: "2026-1022-LAKESIDE-1-KNOCK",
  status: "declined",
  deliveryState: "none",
});

const ALL = [DRAFT, PARTLY, FULLY, NOT_DELIVERED, DECLINED];

function renderAdmin(props: Partial<DocumentsAdminProps> = {}) {
  render(
    <DocumentsAdmin
      quotations={ALL}
      totalCount={ALL.length}
      q=""
      status={null}
      {...props}
    />,
  );
}

const rows = () =>
  within(screen.getByRole("list", { name: "Quotations" })).getAllByRole("link");

const chip = (name: string) => screen.getByRole("button", { name });

/**
 * A row's expected name, as a pattern. jsdom trims each cell's text, dropping the space
 * in the hidden ", " separators that browsers keep, so the space is optional here.
 */
const separated = (name: string) =>
  new RegExp(
    `^${name
      .split(", ")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(", ?")}$`,
  );

beforeEach(() => {
  replace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DocumentsAdmin", () => {
  it("shows each quotation as one link to it", () => {
    renderAdmin();
    expect(rows()).toHaveLength(5);
    expect(rows()[1]).toHaveAttribute("href", `/admin/documents/${PARTLY.id}`);
    expect(rows()[1]).toHaveAccessibleName(
      separated(
        "2026-1027-NORTHWIND-4-KNOCK, Northwind Components Philippines Inc., Oct 27, 2026, ₱102,575.00, Completed, Partly delivered",
      ),
    );
    expect(rows()[1]).toHaveTextContent("₱102,575.00");
    expect(rows()[1]).toHaveTextContent("Oct 27, 2026");
    // The dash is visual only.
    expect(rows()[0]).toHaveAccessibleName(
      separated(
        "2026-1028-BAYVIEW-1-KNOCK, Bayview Fitness Studio, Oct 28, 2026, ₱86,400.00, Draft",
      ),
    );
  });

  it("labels the delivery of completed quotations, and dashes the others", () => {
    renderAdmin();
    const [draft, partly, fully, none, declined] = rows();
    expect(partly).toHaveTextContent("Partly delivered");
    expect(fully).toHaveTextContent("Fully delivered");
    expect(none).toHaveTextContent("Not delivered");
    for (const row of [draft!, declined!]) {
      expect(row).toHaveTextContent("—");
      expect(row).not.toHaveTextContent(/delivered/);
    }
    expect(draft).toHaveTextContent("Draft");
    expect(declined).toHaveTextContent("Declined");
  });

  it("links New quotation and shows the hint", () => {
    renderAdmin();
    expect(screen.getByRole("link", { name: "New quotation" })).toHaveAttribute(
      "href",
      "/admin/documents/new",
    );
    expect(
      screen.getByText(/Delivery receipts are created from a completed/),
    ).toBeVisible();
  });

  it("says when there are no quotations yet, with a New quotation button", () => {
    renderAdmin({ quotations: [], totalCount: 0 });
    expect(screen.getByText("No quotations yet.")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "New quotation" })).toHaveLength(
      2,
    );
    expect(screen.queryByRole("list", { name: "Quotations" })).toBeNull();
    expect(screen.queryByText(/Delivery receipts are created/)).toBeNull();
  });

  it("says when nothing matches the search, or the status", () => {
    renderAdmin({ quotations: [], q: "acme" });
    expect(screen.getByText("No quotations match “acme”.")).toBeVisible();
    cleanup();
    renderAdmin({ quotations: [], status: "declined" });
    expect(screen.getByText("No declined quotations.")).toBeVisible();
  });

  it("marks the selected chip", () => {
    renderAdmin({ status: "draft" });
    expect(chip("Draft")).toHaveAttribute("aria-pressed", "true");
    expect(chip("All")).toHaveAttribute("aria-pressed", "false");
    cleanup();
    renderAdmin();
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
  });

  it("filters by status, keeping the search", () => {
    renderAdmin({ q: "acme" });
    fireEvent.click(chip("Draft"));
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/documents?q=acme&status=draft",
      { scroll: false },
    );
    fireEvent.click(chip("All"));
    expect(replace).toHaveBeenLastCalledWith("/admin/documents?q=acme", {
      scroll: false,
    });
  });

  it("works as plain forms without JavaScript", () => {
    renderAdmin({ q: "acme", status: "completed" });
    const search = screen.getByRole("search");
    expect(search).toHaveAttribute("action", "/admin/documents");
    expect(search.querySelector('input[name="status"]')).toHaveValue(
      "completed",
    );
    expect(chip("Draft")).toHaveAttribute("type", "submit");
    expect(chip("Draft")).toHaveAttribute("value", "draft");
    expect(chip("All")).toHaveAttribute("value", "");
    const chipForm = chip("All").closest("form")!;
    expect(chipForm.querySelector('input[name="q"]')).toHaveValue("acme");
  });

  it("searches after a pause, keeping the status", () => {
    vi.useFakeTimers();
    renderAdmin({ status: "completed" });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "north" },
    });
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(replace).toHaveBeenCalledWith(
      "/admin/documents?q=north&status=completed",
      { scroll: false },
    );
  });

  it("searches at once on Enter", () => {
    renderAdmin();
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "bay" } });
    fireEvent.submit(box.closest("form")!);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/admin/documents?q=bay", {
      scroll: false,
    });
  });
});

describe("DocumentStatus", () => {
  it.each([
    ["draft", "edit_note", "Draft"],
    ["completed", "task_alt", "Completed"],
    ["declined", "block", "Declined"],
  ] as const)("shows %s with its icon and label", (status, icon, label) => {
    render(<DocumentStatus status={status} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText(icon)).toHaveAttribute("aria-hidden", "true");
  });
});
