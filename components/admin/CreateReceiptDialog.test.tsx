// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import type { CreateReceiptAction } from "./actionTypes";
import {
  CreateReceiptDialog,
  type CreateReceiptDialogProps,
} from "./CreateReceiptDialog";
import {
  CABINET_LINE,
  CHAIR_LINE,
  QUOTATION_ID,
  receiptDefaults,
  TABLE_LINE,
} from "./testing/documents";

const RECEIPT_ID = "00000000-0000-4000-8000-0000000000f1";

let createAction: ReturnType<typeof vi.fn<CreateReceiptAction>>;
let onClose: ReturnType<typeof vi.fn<() => void>>;
let onCreated: ReturnType<typeof vi.fn<() => void>>;
let open: MockInstance<typeof window.open>;

function renderDialog(overrides: Partial<CreateReceiptDialogProps> = {}) {
  const dialog = (p: Partial<CreateReceiptDialogProps>) => (
    <SnackbarProvider>
      <CreateReceiptDialog
        open
        quotationId={QUOTATION_ID}
        defaults={receiptDefaults()}
        createAction={createAction}
        onClose={onClose}
        onCreated={onCreated}
        {...p}
      />
    </SnackbarProvider>
  );
  const result = render(dialog(overrides));
  return {
    rerender: (next: Partial<CreateReceiptDialogProps>) =>
      result.rerender(dialog({ ...overrides, ...next })),
  };
}

const deliverNow = (name: string) =>
  screen.getByLabelText(`Deliver now for ${name}`);

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create and print" }));
  });
}

beforeEach(() => {
  createAction = vi.fn<CreateReceiptAction>();
  onClose = vi.fn();
  onCreated = vi.fn();
  open = vi.spyOn(window, "open");
});

afterEach(() => {
  cleanup();
  open.mockRestore();
});

describe("CreateReceiptDialog", () => {
  it("starts from today, the quotation number and what is left on each line", () => {
    renderDialog({ defaults: receiptDefaults([2, 0, 12]) });
    const dialog = within(
      screen.getByRole("dialog", { name: "Create delivery receipt" }),
    );
    expect(dialog.getByLabelText("Date")).toHaveValue("2026-10-28");
    expect(dialog.getByLabelText("Number")).toHaveValue("2026-1027-NORTHWIND");
    expect(dialog.getByLabelText("Number")).toHaveAttribute(
      "placeholder",
      "Type a receipt number",
    );
    expect(dialog.getByLabelText("Delivery address")).toHaveValue(
      "Quezon City",
    );

    expect(deliverNow(TABLE_LINE.name)).toHaveValue(5);
    expect(deliverNow(TABLE_LINE.name)).toHaveAttribute("max", "5");
    expect(deliverNow(CHAIR_LINE.name)).toHaveValue(8);
    // Nothing left on the cabinets: shown, disabled, at 0.
    expect(deliverNow(CABINET_LINE.name)).toBeDisabled();
    expect(deliverNow(CABINET_LINE.name)).toHaveValue(0);
  });

  it("leaves the number empty after the first receipt", () => {
    renderDialog({ defaults: receiptDefaults([], { number: "" }) });
    expect(screen.getByLabelText("Number")).toHaveValue("");
  });

  it("sends every line, then opens the print page and reports", async () => {
    createAction.mockResolvedValue({
      ok: true,
      message: "Receipt DR-1 created.",
      id: RECEIPT_ID,
      number: "DR-1",
    });
    const tab = { opener: window } as unknown as Window;
    open.mockReturnValue(tab);
    renderDialog();
    fireEvent.change(screen.getByLabelText("Number"), {
      target: { value: "DR-1" },
    });
    fireEvent.change(deliverNow(CHAIR_LINE.name), { target: { value: "12" } });
    await submit();

    expect(createAction).toHaveBeenCalledWith(QUOTATION_ID, {
      receiptDate: "2026-10-28",
      number: "DR-1",
      deliveryAddress: "Quezon City",
      lines: [
        { quotationItemId: CABINET_LINE.id, quantity: "2" },
        { quotationItemId: TABLE_LINE.id, quantity: "5" },
        { quotationItemId: CHAIR_LINE.id, quantity: "12" },
      ],
    });
    expect(open).toHaveBeenCalledWith(
      `/admin/print/receipts/${RECEIPT_ID}`,
      "_blank",
    );
    expect(tab.opener).toBeNull();
    expect(onCreated).toHaveBeenCalled();
    // The dialog is still open here (the page closes it), so it shows the message.
    expect(screen.getByText("Receipt DR-1 created.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Print" })).toBeNull();
  });

  it("offers a Print link in the snackbar when the browser blocks the tab", async () => {
    createAction.mockResolvedValue({
      ok: true,
      message: "Receipt DR-1 created.",
      id: RECEIPT_ID,
      number: "DR-1",
    });
    open.mockReturnValue(null);
    renderDialog();
    await submit();
    expect(screen.getByRole("link", { name: "Print" })).toHaveAttribute(
      "href",
      `/admin/print/receipts/${RECEIPT_ID}`,
    );
    expect(onCreated).toHaveBeenCalled();
  });

  it("shows the service's errors under the number and the line, and focuses the first", async () => {
    createAction.mockResolvedValue({
      ok: false,
      fieldErrors: {
        number: "Another delivery receipt already uses this number.",
        [`lines.${CHAIR_LINE.id}`]: "Only 8 left to deliver.",
      },
    });
    renderDialog();
    await submit();
    expect(screen.getByLabelText("Number")).toHaveFocus();
    expect(
      screen.getByText("Another delivery receipt already uses this number."),
    ).toBeVisible();
    expect(deliverNow(CHAIR_LINE.name)).toHaveAttribute("aria-invalid", "true");
    expect(deliverNow(CHAIR_LINE.name)).toHaveAccessibleDescription(
      "Only 8 left to deliver.",
    );
    expect(open).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("focuses the line when only a line is wrong", async () => {
    createAction.mockResolvedValue({
      ok: false,
      fieldErrors: { [`lines.${CHAIR_LINE.id}`]: "Only 8 left to deliver." },
    });
    renderDialog();
    await submit();
    expect(deliverNow(CHAIR_LINE.name)).toHaveFocus();
  });

  it("shows a message about the whole receipt in an alert", async () => {
    createAction.mockResolvedValue({
      ok: false,
      fieldErrors: {},
      formError: "Create receipts from a completed quotation.",
    });
    renderDialog();
    await submit();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Create receipts from a completed quotation.",
    );
    expect(alert).toHaveFocus();
  });

  it("starts again from the latest defaults each time it opens", async () => {
    const { rerender } = renderDialog();
    fireEvent.change(screen.getByLabelText("Number"), {
      target: { value: "Typed" },
    });
    rerender({ open: false });
    rerender({
      open: true,
      defaults: receiptDefaults([2, 5, 12], { number: "" }),
    });
    expect(screen.getByLabelText("Number")).toHaveValue("");
    expect(deliverNow(CHAIR_LINE.name)).toHaveValue(8);
  });

  it("closes on Cancel without saving", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(createAction).not.toHaveBeenCalled();
  });
});
