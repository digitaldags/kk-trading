// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddProductDialog } from "./AddProductDialog";
import { adminProduct, GYM, OFFICE } from "./testing/fixtures";

const CHAIR = adminProduct({
  id: "00000000-0000-4000-8000-0000000000c1",
  name: "Mesh office chair",
  code: "KK-YS 948",
  priceCentavos: 274500,
});
const DESK = adminProduct({
  id: "00000000-0000-4000-8000-0000000000c2",
  name: "Electric standing desk",
  code: "KK-DESK-01",
  priceCentavos: 1895000,
});
const BENCH = adminProduct({
  id: "00000000-0000-4000-8000-0000000000c3",
  name: "Adjustable bench",
  code: "",
  category: GYM,
  priceCentavos: 1200000,
});

function renderDialog(addedIds: string[] = []) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  render(
    <AddProductDialog
      open
      products={[CHAIR, DESK, BENCH]}
      categories={[OFFICE, GYM]}
      addedIds={new Set(addedIds)}
      onAdd={onAdd}
      onClose={onClose}
    />,
  );
  const dialog = within(screen.getByRole("dialog", { name: "Add product" }));
  return { dialog, onAdd, onClose };
}

const rowNames = (dialog: ReturnType<typeof within>) =>
  dialog.queryAllByRole("listitem").map((row: HTMLElement) => row.textContent);

afterEach(cleanup);

describe("AddProductDialog", () => {
  it("lists the catalog with each product's code and price", () => {
    const { dialog } = renderDialog();
    const rows = dialog.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Mesh office chair");
    expect(rows[0]).toHaveTextContent("KK-YS 948 · ₱2,745");
    // No code: just the price.
    expect(rows[2]).toHaveTextContent("Adjustable bench₱12,000");
    expect(
      dialog.getByText(
        "Each product is added once at its catalog price. Change the quantity and price on the quotation.",
      ),
    ).toBeVisible();
  });

  it("searches by name or code, ignoring case", () => {
    const { dialog } = renderDialog();
    const search = dialog.getByRole("searchbox", {
      name: "Search by name or code",
    });
    fireEvent.change(search, { target: { value: "desk-01" } });
    expect(rowNames(dialog)).toEqual([
      expect.stringContaining("Electric standing desk"),
    ]);
    fireEvent.change(search, { target: { value: "BENCH" } });
    expect(rowNames(dialog)).toEqual([
      expect.stringContaining("Adjustable bench"),
    ]);
    fireEvent.change(search, { target: { value: "sofa" } });
    expect(dialog.getByText("No products match “sofa”.")).toBeVisible();
  });

  it("filters by category with the chips", () => {
    const { dialog } = renderDialog();
    const group = within(
      dialog.getByRole("group", { name: "Filter by category" }),
    );
    expect(group.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(group.getByRole("button", { name: GYM.name }));
    expect(rowNames(dialog)).toEqual([
      expect.stringContaining("Adjustable bench"),
    ]);
    fireEvent.click(group.getByRole("button", { name: "All" }));
    expect(dialog.getAllByRole("listitem")).toHaveLength(3);
  });

  it("adds a product, and marks products already on the quotation as Added", () => {
    const { dialog, onAdd } = renderDialog([CHAIR.id]);
    expect(
      dialog.getByRole("button", { name: `Added ${CHAIR.name}` }),
    ).toBeDisabled();
    fireEvent.click(dialog.getByRole("button", { name: `Add ${DESK.name}` }));
    expect(onAdd).toHaveBeenCalledWith(DESK);
  });

  it("closes with Done", () => {
    const { dialog, onClose } = renderDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });
});
