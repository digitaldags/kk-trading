// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import type { ImportPreview, ImportRowInput } from "@/lib/domain/productImport";
import type { ReadResult } from "@/lib/spreadsheet/readProductsFile";
import type { ImportProductsAction, PreviewImportAction } from "./actionTypes";
import { downloadBlob } from "./downloadBlob";
import {
  ImportProductsDialog,
  type ImportProductsDialogProps,
} from "./ImportProductsDialog";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./downloadBlob", () => ({ downloadBlob: vi.fn() }));

const CATEGORIES = [{ name: "Office" }, { name: "Gym" }];

const row = (code: string): ImportRowInput => ({
  code,
  name: `Product ${code}`,
  category: "Office",
  unit: "pcs",
  price: "100",
  stockStatus: "In stock",
  keySpec: "",
  description: "",
  specs: "",
});

const RAN: ReadResult = {
  ok: true,
  rows: [row("A"), row("B"), row("C")],
  rowNumbers: [2, 3, 7],
  ignoredColumns: [],
};

const preview = (
  overrides: Partial<ImportPreview> = {},
): { ok: true; data: ImportPreview } => ({
  ok: true,
  data: {
    toCreate: 2,
    unchanged: 1,
    rows: [
      { index: 0, code: "A", name: "Product A", outcome: "create" },
      { index: 1, code: "B", name: "Product B", outcome: "create" },
      { index: 2, code: "C", name: "Product C", outcome: "unchanged" },
    ],
    ...overrides,
  },
});

let previewAction: ReturnType<typeof vi.fn<PreviewImportAction>>;
let importAction: ReturnType<typeof vi.fn<ImportProductsAction>>;
let readFile: ReturnType<typeof vi.fn<ImportProductsDialogProps["readFile"]>>;
let buildTemplate: ReturnType<
  typeof vi.fn<ImportProductsDialogProps["buildTemplate"]>
>;
let onClose: ReturnType<typeof vi.fn<() => void>>;

function dialogElement(overrides: Partial<ImportProductsDialogProps> = {}) {
  return (
    <SnackbarProvider>
      <ImportProductsDialog
        open
        categories={CATEGORIES}
        hasUnpublishedChanges={false}
        previewAction={previewAction}
        importAction={importAction}
        readFile={readFile}
        buildTemplate={buildTemplate}
        onClose={onClose}
        {...overrides}
      />
    </SnackbarProvider>
  );
}

const renderDialog = (overrides?: Partial<ImportProductsDialogProps>) =>
  render(dialogElement(overrides));

const fileInput = () =>
  screen.getByLabelText<HTMLInputElement>("Excel file (.xlsx)");

const FILE = new File(["x"], "products.xlsx");

async function choose(file = FILE) {
  await act(async () => {
    fireEvent.change(fileInput(), { target: { files: [file] } });
  });
}

const importButton = (name: RegExp | string = /^Import \d+ products?$/) =>
  screen.queryByRole("button", { name });

/** Text on the page. Summaries are in the live region too. */
const shown = (text: string) =>
  screen.getByText(text, { ignore: "[aria-live]" });

const live = () => document.querySelector('[aria-live="polite"]');

beforeEach(() => {
  refresh.mockReset();
  vi.mocked(downloadBlob).mockReset();
  previewAction = vi.fn<PreviewImportAction>(async () => preview());
  importAction = vi.fn<ImportProductsAction>(async () => ({
    ok: true,
    data: { created: 2, unchanged: 1 },
  }));
  readFile = vi.fn(async () => RAN);
  buildTemplate = vi.fn(async () => new Blob(["template"]));
  onClose = vi.fn();
});

afterEach(cleanup);

describe("choosing a file", () => {
  it("explains the import and labels the file input", () => {
    renderDialog();
    expect(
      screen.getByText(
        "Add many products at once from an Excel file. Products that already exist are skipped, and nothing existing is changed.",
      ),
    ).toBeVisible();
    expect(fileInput()).toHaveAttribute("type", "file");
    expect(fileInput()).toHaveAttribute("accept", ".xlsx");
    expect(fileInput()).toHaveAccessibleDescription(
      "Up to 500 products and 2 MB. Photos are added afterwards in the product editor.",
    );
  });

  it("warns about unpublished changes only when there are some", () => {
    const warning = /You have unpublished changes/;
    const { unmount } = renderDialog({ hasUnpublishedChanges: true });
    expect(screen.getByText(warning)).toBeVisible();
    unmount();

    renderDialog({ hasUnpublishedChanges: false });
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it("downloads a template built from the page's categories", async () => {
    renderDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "Download template" }),
    );

    expect(buildTemplate).toHaveBeenCalledWith(CATEGORIES);
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "kk-trading-products-template.xlsx",
    );
  });

  it("says so when the template can't be built", async () => {
    buildTemplate.mockRejectedValue(new Error("No library"));
    renderDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "Download template" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't build the template. Try again.",
    );
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("shows a busy state while it checks, and holds the dialog open", async () => {
    let finish!: (result: ReadResult) => void;
    readFile.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderDialog();
    await choose();

    expect(shown("Checking products.xlsx…")).toBeVisible();
    expect(live()).toHaveTextContent("Checking products.xlsx…");
    expect(fileInput()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Download template" }),
    ).toBeDisabled();

    fireEvent(
      document.querySelector("dialog")!,
      new Event("cancel", { cancelable: true }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => finish(RAN));
    expect(screen.getByRole("heading", { name: "Preview" })).toBeVisible();
  });

  it.each([
    "Choose an Excel file saved as .xlsx.",
    "The file is larger than 2 MB. Split it into smaller files.",
    "Add the missing column: Code.",
  ])("shows %j without calling the server", async (error) => {
    readFile.mockResolvedValue({ ok: false, error });
    renderDialog();
    await choose();

    expect(screen.getByRole("alert")).toHaveTextContent(error);
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(previewAction).not.toHaveBeenCalled();
    expect(fileInput()).toBeEnabled();
  });

  it("clears the input, so the same file can be chosen again", async () => {
    renderDialog();
    const input = fileInput();
    const clearValue = vi.spyOn(input, "value", "set");
    await choose();
    expect(clearValue).toHaveBeenCalledWith("");
  });

  it("shows a form error from the server on this step", async () => {
    previewAction.mockResolvedValue({
      ok: false,
      fieldErrors: {},
      formError: "Import up to 500 products at a time.",
    });
    renderDialog();
    await choose();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Import up to 500 products at a time.",
    );
    expect(fileInput()).toBeVisible();
  });

  it("recovers when the check fails outright", async () => {
    previewAction.mockRejectedValue(new Error("Body exceeded 3 MB limit"));
    renderDialog();
    await choose();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't check that file. Try again.",
    );
    expect(fileInput()).toBeEnabled();
  });

  it("recovers when the file can't be read at all", async () => {
    readFile.mockRejectedValue(new Error("Chunk failed to load"));
    renderDialog();
    await choose();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't check that file. Try again.",
    );
    expect(previewAction).not.toHaveBeenCalled();
  });
});

describe("the preview", () => {
  it("sends the file's rows and their Excel row numbers", async () => {
    renderDialog();
    await choose();
    expect(previewAction).toHaveBeenCalledWith(RAN.ok && RAN.rows, [2, 3, 7]);
  });

  it("gives the counts, and lists only the products to add", async () => {
    renderDialog();
    await choose();

    const summary =
      "2 products will be added. 1 already exists and will be skipped.";
    expect(shown(summary)).toBeVisible();
    expect(live()).toHaveTextContent(summary);

    const list = screen.getByRole("region", { name: "Products to add" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveTextContent("Product A");
    expect(list).not.toHaveTextContent("Product C");
    expect(importButton("Import 2 products")).toBeEnabled();
  });

  it("moves focus to the step's heading", async () => {
    renderDialog();
    await choose();
    expect(screen.getByRole("heading", { name: "Preview" })).toHaveFocus();
  });

  it("uses the singular for one product, and leaves out a zero skip count", async () => {
    previewAction.mockResolvedValue(
      preview({
        toCreate: 1,
        unchanged: 0,
        rows: [{ index: 0, code: "A", name: "Product A", outcome: "create" }],
      }),
    );
    renderDialog();
    await choose();

    expect(shown("1 product will be added.")).toBeVisible();
    expect(importButton("Import 1 product")).toBeVisible();
  });

  it("lists ignored columns", async () => {
    readFile.mockResolvedValue({
      ...RAN,
      ignoredColumns: ["Notes", "Supplier"],
    } as ReadResult);
    renderDialog();
    await choose();
    expect(screen.getByText("Ignored columns: Notes, Supplier.")).toBeVisible();
  });

  it("caps the list at 100 products", async () => {
    previewAction.mockResolvedValue(
      preview({
        toCreate: 130,
        unchanged: 0,
        rows: Array.from({ length: 130 }, (_, index) => ({
          index,
          code: `C-${index}`,
          name: `Product ${index}`,
          outcome: "create" as const,
        })),
      }),
    );
    renderDialog();
    await choose();

    const list = screen.getByRole("region", { name: "Products to add" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(100);
    expect(list).toHaveTextContent("and 30 more");
  });

  it("offers no import when every product already exists", async () => {
    previewAction.mockResolvedValue(
      preview({
        toCreate: 0,
        unchanged: 3,
        rows: [{ index: 0, code: "A", name: "A", outcome: "unchanged" }],
      }),
    );
    renderDialog();
    await choose();

    expect(
      shown(
        "0 products will be added. 3 already exist and will be skipped. Nothing to import. Every product in the file already exists.",
      ),
    ).toBeVisible();
    expect(importButton()).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Products to add" }),
    ).not.toBeInTheDocument();
  });

  it("goes back to the file input with Choose another file", async () => {
    renderDialog();
    await choose();
    await userEvent.click(
      screen.getByRole("button", { name: "Choose another file" }),
    );
    expect(fileInput()).toHaveFocus();
  });

  it("can be used with the keyboard alone", async () => {
    const user = userEvent.setup();
    renderDialog();
    await choose();

    await user.tab();
    expect(
      screen.getByRole("region", { name: "Products to add" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Choose another file" }),
    ).toHaveFocus();
    await user.tab();
    expect(importButton("Import 2 products")).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(importAction).toHaveBeenCalled());
  });
});

describe("a file with problems", () => {
  const problems = {
    "rows.1.price": "Enter a price of 0 or more, numbers only.",
    "rows.1.category": "Unknown category “Offce”. Use one of: Office, Gym.",
    "rows.2.code": "Row 2 in this file uses the same code.",
  };

  beforeEach(() => {
    previewAction.mockResolvedValue({ ok: false, fieldErrors: problems });
  });

  it("gives the counts, and each problem with its Excel row", async () => {
    renderDialog();
    await choose();

    const summary =
      "3 problems in 2 rows. Nothing was imported. Fix the file and choose it again.";
    expect(shown(summary)).toBeVisible();
    expect(live()).toHaveTextContent(summary);

    const items = within(
      screen.getByRole("region", { name: "Problems by row" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // Row 3 (index 1) lists its columns in file order.
    expect(items[0]!.textContent).toBe(
      "Row 3, Category: Unknown category “Offce”. Use one of: Office, Gym." +
        "Row 3, Price: Enter a price of 0 or more, numbers only.",
    );
    expect(items[1]).toHaveTextContent(
      "Row 7, Code: Row 2 in this file uses the same code.",
    );
  });

  it("offers no import, only another file", async () => {
    renderDialog();
    await choose();

    expect(importButton()).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose another file" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Problems in this file" }),
    ).toHaveFocus();
  });

  it("uses the singular for one problem", async () => {
    previewAction.mockResolvedValue({
      ok: false,
      fieldErrors: { "rows.0.name": "Enter a product name." },
    });
    renderDialog();
    await choose();
    expect(
      shown(
        "1 problem in 1 row. Nothing was imported. Fix the file and choose it again.",
      ),
    ).toBeVisible();
  });

  it("shows the first 50 rows, then how many are left", async () => {
    const rowNumbers = Array.from({ length: 61 }, (_, i) => i + 2);
    readFile.mockResolvedValue({
      ok: true,
      rows: rowNumbers.map((n) => row(`C-${n}`)),
      rowNumbers,
      ignoredColumns: [],
    });
    previewAction.mockResolvedValue({
      ok: false,
      fieldErrors: Object.fromEntries(
        rowNumbers.map((_, i) => [`rows.${i}.name`, "Enter a product name."]),
      ),
    });
    renderDialog();
    await choose();

    const list = screen.getByRole("region", { name: "Problems by row" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(50);
    expect(list).toHaveTextContent("and 11 more rows.");
  });

  it("reaches the list with the keyboard", async () => {
    const user = userEvent.setup();
    renderDialog();
    await choose();
    await user.tab();
    expect(
      screen.getByRole("region", { name: "Problems by row" }),
    ).toHaveFocus();
  });
});

describe("importing", () => {
  async function renderPreview() {
    renderDialog();
    await choose();
  }

  it("sends the same rows, then closes, refreshes and says what happened", async () => {
    await renderPreview();
    await userEvent.click(importButton("Import 2 products")!);

    expect(importAction).toHaveBeenCalledWith(RAN.ok && RAN.rows, [2, 3, 7]);
    expect(onClose).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    expect(
      screen.getByText(
        "Imported 2 products. Publish to show them on the store. 1 skipped.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves out the skip count when nothing was skipped, and uses the singular", async () => {
    importAction.mockResolvedValue({
      ok: true,
      data: { created: 1, unchanged: 0 },
    });
    await renderPreview();
    await userEvent.click(importButton()!);
    expect(
      screen.getByText(
        "Imported 1 product. Publish to show them on the store.",
      ),
    ).toBeInTheDocument();
  });

  it("disables the buttons and holds the dialog open while it runs", async () => {
    let finish!: Parameters<ConstructorParameters<typeof Promise>[0]>[0];
    importAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve as typeof finish;
      }),
    );
    await renderPreview();
    await userEvent.click(importButton("Import 2 products")!);

    expect(importButton("Import 2 products")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Choose another file" }),
    ).toBeDisabled();
    expect(live()).toHaveTextContent("Importing the products…");

    fireEvent(
      document.querySelector("dialog")!,
      new Event("cancel", { cancelable: true }),
    );
    expect(onClose).not.toHaveBeenCalled();

    await act(async () =>
      finish({ ok: true, data: { created: 2, unchanged: 1 } }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays on the preview with the message when a code was taken meanwhile", async () => {
    const message =
      "Another product was added with the code A while you were importing. Preview the file again.";
    importAction.mockResolvedValue({
      ok: false,
      fieldErrors: {},
      formError: message,
    });
    await renderPreview();
    await userEvent.click(importButton("Import 2 products")!);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("goes to the problems step when the catalog changed", async () => {
    importAction.mockResolvedValue({
      ok: false,
      fieldErrors: {
        "rows.0.code":
          "A already exists with a different price. Edit it in the product editor.",
      },
    });
    await renderPreview();
    await userEvent.click(importButton("Import 2 products")!);

    expect(
      screen.getByRole("heading", { name: "Problems in this file" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("region", { name: "Problems by row" }),
    ).toHaveTextContent("Row 2, Code: A already exists");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("lets the import be tried again after it fails outright", async () => {
    importAction.mockRejectedValueOnce(new Error("Network"));
    await renderPreview();
    await userEvent.click(importButton("Import 2 products")!);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't import the products. Try again.",
    );
    await userEvent.click(importButton("Import 2 products")!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("closing", () => {
  it("closes at any step when nothing is running", async () => {
    renderDialog();
    await choose();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("starts again from the first step when it reopens", async () => {
    const { rerender } = renderDialog();
    await choose();
    rerender(dialogElement({ open: false }));
    rerender(dialogElement({ open: true }));

    expect(fileInput()).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Preview" }),
    ).not.toBeInTheDocument();
  });

  it("catches up when the browser closed the dialog during the work", async () => {
    let finish!: (result: ReadResult) => void;
    readFile.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderDialog();
    await choose();

    // Chrome's second Escape: the element closes though `open` stays true.
    document.querySelector("dialog")!.open = false;
    await act(async () => finish(RAN));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
