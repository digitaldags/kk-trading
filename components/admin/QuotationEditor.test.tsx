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
import { QUOTATION_DEFAULTS } from "@/lib/domain/documents";
import type { QuotationWithItems } from "@/lib/domain/types";
import type { QuotationDraftDefaults } from "@/lib/services/quotationService";
import type {
  QuotationAction,
  SaveQuotationAction,
  SaveQuotationResult,
} from "./actionTypes";
import { QuotationEditor, type QuotationEditorProps } from "./QuotationEditor";
import { adminProduct, GYM, OFFICE } from "./testing/fixtures";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

// The sample quotation: 2 × 8,450 + 5 × 6,155 + 20 × 2,745 = ₱102,575.00.
const CABINET = adminProduct({
  id: "00000000-0000-4000-8000-0000000000c1",
  name: "4-drawer steel filing cabinet",
  code: "KK-DG-D4",
  specs: "Powder coating finish\nGang drawer locking",
  priceCentavos: 845000,
});
const TABLE = adminProduct({
  id: "00000000-0000-4000-8000-0000000000c2",
  name: "Office table, white",
  code: "KK-GF-Z014",
  priceCentavos: 615500,
});
const CHAIR = adminProduct({
  id: "00000000-0000-4000-8000-0000000000c3",
  name: "Mesh office chair",
  code: "KK-YS 948",
  priceCentavos: 274500,
});
const BENCH = adminProduct({
  id: "00000000-0000-4000-8000-0000000000c4",
  name: "Adjustable bench",
  code: "",
  category: GYM,
  priceCentavos: 1200000,
});
const CATALOG = [CABINET, TABLE, CHAIR, BENCH];

const DEFAULTS: QuotationDraftDefaults = {
  number: "",
  quoteDate: "2026-10-27",
  customerName: "",
  customerAddress: "",
  customerTin: "",
  deliveryAddress: "",
  ...QUOTATION_DEFAULTS,
  items: [],
};

const ID = "00000000-0000-4000-8000-0000000000d1";

function savedQuotation(
  overrides: Partial<QuotationWithItems> = {},
): QuotationWithItems {
  const at = new Date("2026-10-27T07:42:00Z");
  return {
    id: ID,
    number: "2026-1027-NORTHWIND-4-KNOCK",
    status: "draft",
    quoteDate: "2026-10-27",
    customerName: "Northwind",
    customerAddress: "",
    customerTin: "",
    deliveryAddress: "",
    ...QUOTATION_DEFAULTS,
    completedAt: null,
    declinedAt: null,
    createdAt: at,
    updatedAt: at,
    items: [
      {
        id: "00000000-0000-4000-8000-0000000000e1",
        quotationId: ID,
        position: 0,
        productId: CABINET.id,
        code: CABINET.code,
        name: CABINET.name,
        specs: CABINET.specs,
        uom: "pcs",
        imageUrl: null,
        unitPriceCentavos: 845000,
        quantity: 2,
      },
    ],
    ...overrides,
  };
}

const ok = (overrides: Partial<SaveQuotationResult> = {}) =>
  ({
    ok: true,
    message: "Saved quotation Q-1.",
    id: ID,
    number: "Q-1",
    updatedAt: "2026-10-27T07:42:00.000Z",
    ...overrides,
  }) as SaveQuotationResult;

let actions: {
  saveAction: ReturnType<typeof vi.fn<SaveQuotationAction>>;
  completeAction: ReturnType<typeof vi.fn<QuotationAction>>;
  declineAction: ReturnType<typeof vi.fn<QuotationAction>>;
  deleteAction: ReturnType<typeof vi.fn<QuotationAction>>;
};

function renderEditor(props: Partial<QuotationEditorProps> = {}) {
  render(
    <SnackbarProvider>
      <QuotationEditor
        quotation={null}
        defaults={DEFAULTS}
        catalog={CATALOG}
        categories={[OFFICE, GYM]}
        {...actions}
        {...props}
      />
    </SnackbarProvider>,
  );
}

const snackbar = () => screen.getAllByRole("status").at(-1)!;
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const items = () => within(screen.getByRole("list", { name: "Items" }));

/** Opens Add product, adds each product, then closes the dialog. */
async function addProducts(...names: string[]) {
  fireEvent.click(button("Add product"));
  const dialog = within(screen.getByRole("dialog", { name: "Add product" }));
  for (const name of names) {
    fireEvent.click(dialog.getByRole("button", { name: `Add ${name}` }));
  }
  await act(async () => {});
  fireEvent.click(dialog.getByRole("button", { name: "Done" }));
}

function setQuantity(name: string, value: string) {
  fireEvent.change(screen.getByLabelText(`Quantity for ${name}`), {
    target: { value },
  });
}

async function flush() {
  await act(async () => {});
}

beforeEach(() => {
  replace.mockReset();
  actions = {
    saveAction: vi.fn<SaveQuotationAction>(async () => ok()),
    completeAction: vi.fn<QuotationAction>(async () => ({
      ok: true,
      message: "Marked Q-1 as completed.",
    })),
    declineAction: vi.fn<QuotationAction>(async () => ({
      ok: true,
      message: "Marked Q-1 as declined.",
    })),
    deleteAction: vi.fn<QuotationAction>(async () => ({
      ok: true,
      message: "Deleted quotation Q-1.",
    })),
  };
  window.history.replaceState(null, "", "/admin/documents/new");
});

afterEach(cleanup);

describe("QuotationEditor: a new quotation", () => {
  it("starts from the defaults, unsaved", () => {
    renderEditor();
    expect(
      screen.getByRole("heading", { level: 1, name: "New quotation" }),
    ).toBeVisible();
    expect(screen.getByText("Quotation · Not saved yet")).toBeVisible();
    expect(screen.getByLabelText("Payment terms")).toHaveValue(
      "100% PAYMENT BEFORE DELIVERY",
    );
    expect(
      screen.getByText("No products yet. Add products from the catalog."),
    ).toBeVisible();
    expect(button("Print preview")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Delete draft" })).toBeNull();
  });

  it("totals the sample to ₱102,575.00 as quantities are typed, and after saving", async () => {
    renderEditor();
    await addProducts(CABINET.name, TABLE.name, CHAIR.name);
    setQuantity(CABINET.name, "2");
    setQuantity(TABLE.name, "5");
    setQuantity(CHAIR.name, "20");

    const rows = items().getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(
      "KK-DG-D4 · 4-drawer steel filing cabinet",
    );
    expect(rows[0]).toHaveTextContent(
      "Powder coating finish · Gang drawer locking",
    );
    expect(rows[0]).toHaveTextContent("₱16,900.00");
    expect(rows[2]).toHaveTextContent("₱54,900.00");
    expect(screen.getAllByText("₱102,575.00")).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Number"), {
      target: { value: "Q-1" },
    });
    fireEvent.change(screen.getByLabelText("Customer name"), {
      target: { value: "Northwind" },
    });
    fireEvent.click(button("Save"));
    await flush();

    expect(actions.saveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        number: "Q-1",
        customerName: "Northwind",
        items: [
          { productId: CABINET.id, quantity: "2", unitPrice: "8,450.00" },
          { productId: TABLE.id, quantity: "5", unitPrice: "6,155.00" },
          { productId: CHAIR.id, quantity: "20", unitPrice: "2,745.00" },
        ],
      }),
    );
    expect(actions.saveAction.mock.calls[0]![0]).not.toHaveProperty("id");
    expect(snackbar()).toHaveTextContent("Saved quotation Q-1.");
    expect(screen.getAllByText("₱102,575.00")).toHaveLength(2);
    // The first save shows the quotation's own URL, without reloading.
    expect(window.location.pathname).toBe(`/admin/documents/${ID}`);
    expect(
      screen.getByRole("heading", { level: 1, name: "Q-1" }),
    ).toBeVisible();
    expect(screen.getByText(/Last saved Oct 27, 2026, 3:42 PM/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Print preview" })).toHaveAttribute(
      "href",
      `/admin/print/quotations/${ID}`,
    );
  });

  it("changes only this quotation's price", async () => {
    renderEditor();
    await addProducts(CHAIR.name);
    fireEvent.change(screen.getByLabelText(`Unit price for ${CHAIR.name}`), {
      target: { value: "2,500" },
    });
    expect(items().getByRole("listitem")).toHaveTextContent("₱2,500.00");
    expect(CHAIR.priceCentavos).toBe(274500);
  });

  it("shows a dash while a quantity or price isn't valid", async () => {
    renderEditor();
    await addProducts(CHAIR.name);
    setQuantity(CHAIR.name, "two");
    expect(items().getByRole("listitem")).toHaveTextContent("—");
    expect(screen.getAllByText("₱0.00")).toHaveLength(2);
  });

  it("shows products already on the quotation as Added", async () => {
    renderEditor();
    await addProducts(CHAIR.name);
    fireEvent.click(button("Add product"));
    const dialog = within(screen.getByRole("dialog", { name: "Add product" }));
    expect(
      dialog.getByRole("button", { name: `Added ${CHAIR.name}` }),
    ).toBeDisabled();
  });

  it("removes a line by its code, or its name when it has none", async () => {
    renderEditor();
    await addProducts(CHAIR.name, BENCH.name);
    fireEvent.click(button("Remove KK-YS 948"));
    fireEvent.click(button(`Remove ${BENCH.name}`));
    expect(
      screen.getByText("No products yet. Add products from the catalog."),
    ).toBeVisible();
  });

  it("shows field errors under their fields and line errors under their row", async () => {
    actions.saveAction.mockResolvedValue({
      ok: false,
      fieldErrors: {
        number: "Another quotation already uses this number.",
        "items.0": "Enter a whole number of 1 or more.",
      },
    });
    renderEditor();
    await addProducts(CHAIR.name);
    fireEvent.click(button("Save"));
    await flush();

    expect(screen.getByLabelText("Number")).toHaveAccessibleDescription(
      /Another quotation already uses this number\./,
    );
    expect(screen.getByLabelText("Number")).toHaveFocus();
    expect(
      screen.getByLabelText(`Quantity for ${CHAIR.name}`),
    ).toHaveAccessibleDescription("Enter a whole number of 1 or more.");
    expect(window.location.pathname).toBe("/admin/documents/new");

    // Editing the lines clears their errors: the indexes may have moved.
    setQuantity(CHAIR.name, "3");
    expect(screen.queryByText("Enter a whole number of 1 or more.")).toBeNull();
  });

  it("sends a form error to the snackbar", async () => {
    actions.saveAction.mockResolvedValue({
      ok: false,
      fieldErrors: {},
      formError: "Completed and declined quotations can't be edited.",
    });
    renderEditor();
    fireEvent.click(button("Save"));
    await flush();
    expect(snackbar()).toHaveTextContent(
      "Completed and declined quotations can't be edited.",
    );
  });

  it("saves before asking to complete, then locks and reloads", async () => {
    renderEditor();
    fireEvent.click(button("Mark as completed"));
    await flush();
    expect(actions.saveAction).toHaveBeenCalledTimes(1);

    const dialog = within(
      screen.getByRole("dialog", { name: "Mark as completed?" }),
    );
    expect(
      dialog.getByText("The quotation can't be edited after this."),
    ).toBeVisible();
    fireEvent.click(dialog.getByRole("button", { name: "Mark as completed" }));
    await flush();

    expect(actions.completeAction).toHaveBeenCalledWith(ID);
    // Messages queue: the save's shows first, the completion's next.
    expect(snackbar()).toHaveTextContent("Saved quotation Q-1.");
    expect(replace).toHaveBeenCalledWith(`/admin/documents/${ID}`);
  });

  it("asks nothing when saving first fails", async () => {
    actions.saveAction.mockResolvedValue({
      ok: false,
      fieldErrors: { number: "Enter the quotation number." },
    });
    renderEditor();
    fireEvent.click(button("Mark as declined"));
    await flush();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(actions.declineAction).not.toHaveBeenCalled();
  });
});

describe("QuotationEditor: a saved draft", () => {
  it("shows its number, the last save and Delete draft", () => {
    renderEditor({ quotation: savedQuotation() });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "2026-1027-NORTHWIND-4-KNOCK",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Quotation · Last saved Oct 27, 2026, 3:42 PM"),
    ).toBeVisible();
    expect(screen.getByLabelText(`Unit price for ${CABINET.name}`)).toHaveValue(
      "8,450.00",
    );
  });

  it("completes without saving again when nothing changed", async () => {
    renderEditor({ quotation: savedQuotation() });
    fireEvent.click(button("Mark as completed"));
    await flush();
    expect(actions.saveAction).not.toHaveBeenCalled();
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Mark as completed?" }),
      ).getByRole("button", { name: "Mark as completed" }),
    );
    await flush();
    expect(snackbar()).toHaveTextContent("Marked Q-1 as completed.");
    expect(replace).toHaveBeenCalledWith(`/admin/documents/${ID}`);
  });

  it("saves by id", async () => {
    renderEditor({ quotation: savedQuotation() });
    fireEvent.click(button("Save"));
    await flush();
    expect(actions.saveAction.mock.calls[0]![0]).toMatchObject({ id: ID });
  });

  it("shows why it can't be completed, and stays a draft", async () => {
    actions.completeAction.mockResolvedValue({
      ok: false,
      message: "Add at least one product before completing.",
    });
    renderEditor({ quotation: savedQuotation({ items: [] }) });
    fireEvent.click(button("Mark as completed"));
    await flush();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Mark as completed",
      }),
    );
    await flush();
    expect(snackbar()).toHaveTextContent(
      "Add at least one product before completing.",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("asks before deleting, then goes back to the list", async () => {
    renderEditor({ quotation: savedQuotation() });
    fireEvent.click(button("Delete draft"));
    const dialog = within(
      screen.getByRole("dialog", { name: "Delete this draft?" }),
    );
    expect(dialog.getByText("This can't be undone.")).toBeVisible();
    fireEvent.click(dialog.getByRole("button", { name: "Delete draft" }));
    await flush();
    expect(actions.deleteAction).toHaveBeenCalledWith(ID);
    expect(snackbar()).toHaveTextContent("Deleted quotation Q-1.");
    expect(replace).toHaveBeenCalledWith("/admin/documents");
  });

  it("asks before leaving only while there are unsaved edits", () => {
    renderEditor({ quotation: savedQuotation() });
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(leave()).toBe(false);
    fireEvent.change(screen.getByLabelText("Customer name"), {
      target: { value: "Changed" },
    });
    expect(leave()).toBe(true);
  });
});
