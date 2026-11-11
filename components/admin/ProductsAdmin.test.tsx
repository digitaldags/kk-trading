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
import { buildExport } from "@/lib/spreadsheet/buildExport";
import { downloadBlob } from "./downloadBlob";
import {
  ProductsAdmin,
  SEARCH_DEBOUNCE_MS,
  type ProductsAdminProps,
} from "./ProductsAdmin";
import { adminProduct, GYM, OFFICE } from "./testing/fixtures";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));
vi.mock("@/lib/spreadsheet/buildExport", () => ({ buildExport: vi.fn() }));
vi.mock("./downloadBlob", () => ({ downloadBlob: vi.fn() }));

const CHAIR = adminProduct({ isSample: true });
const BENCH = adminProduct({
  id: "00000000-0000-4000-8000-0000000000b2",
  name: "Adjustable FID bench",
  keySpec: "",
  category: GYM,
  stockStatus: "low_stock",
});

function renderAdmin(props: Partial<ProductsAdminProps> = {}) {
  const all: ProductsAdminProps = {
    products: [CHAIR, BENCH],
    totalCount: 2,
    sampleCount: 1,
    categories: [OFFICE, GYM],
    q: "",
    editor: null,
    missingProduct: false,
    deleteAction: vi.fn(async () => ({ ok: true, message: "Deleted." })),
    saveAction: vi.fn(),
    discardUploadAction: vi.fn(),
    hasUnpublishedChanges: false,
    previewImportAction: vi.fn(),
    importAction: vi.fn(),
    exportAction: vi.fn(),
    ...props,
  };
  render(
    <SnackbarProvider>
      <ProductsAdmin {...all} />
    </SnackbarProvider>,
  );
  return all;
}

/** The page's snackbar region (a dialog adds its own while open). */
const snackbar = () => screen.getAllByRole("status").at(-1)!;

beforeEach(() => {
  replace.mockReset();
  push.mockReset();
  window.history.replaceState(null, "", "/admin");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Import and Export", () => {
  const EXPORT = {
    products: [],
    categories: [{ name: "Office equipment" }],
  };

  beforeEach(() => {
    vi.mocked(buildExport).mockReset();
    vi.mocked(downloadBlob).mockReset();
  });

  it("opens the import dialog, and warns of unpublished changes when there are some", () => {
    renderAdmin({ hasUnpublishedChanges: true });
    expect(screen.queryByLabelText("Excel file (.xlsx)")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByLabelText("Excel file (.xlsx)")).toBeVisible();
    expect(screen.getByText(/You have unpublished changes/)).toBeVisible();
  });

  it("closes the import dialog again", () => {
    renderAdmin();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByLabelText("Excel file (.xlsx)")).toBeNull();
  });

  it("builds the export from the action, not the page's filtered list, and downloads it", async () => {
    const file = new Blob(["xlsx"]);
    vi.mocked(buildExport).mockResolvedValue(file);
    const exportAction = vi.fn(async () => EXPORT);
    renderAdmin({ exportAction, q: "chair", products: [CHAIR] });

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    await vi.waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(exportAction).toHaveBeenCalledWith();
    expect(buildExport).toHaveBeenCalledWith(
      EXPORT.products,
      EXPORT.categories,
    );
    expect(downloadBlob).toHaveBeenCalledWith(
      file,
      expect.stringMatching(/^kk-trading-products-\d{4}-\d{2}-\d{2}\.xlsx$/),
    );
  });

  it("disables Export while it runs", async () => {
    let finish!: (value: typeof EXPORT) => void;
    const exportAction = vi.fn(
      () =>
        new Promise<typeof EXPORT>((resolve) => {
          finish = resolve;
        }),
    );
    renderAdmin({ exportAction });

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Export" })).toBeDisabled(),
    );

    await act(async () => finish(EXPORT));
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });

  it("says so when the export fails", async () => {
    renderAdmin({
      exportAction: vi.fn(async () => {
        throw new Error("Network");
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    await vi.waitFor(() =>
      expect(snackbar()).toHaveTextContent(
        "Couldn't export the products. Try again.",
      ),
    );
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});

describe("ProductsAdmin", () => {
  it("lists products with their category, spec and Sample tag", () => {
    renderAdmin();
    const rows = within(
      screen.getByRole("list", { name: "Products" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Ergonomic mesh chair");
    expect(rows[0]).toHaveTextContent("Sample");
    expect(rows[0]).toHaveTextContent(
      "Office equipment · Seat height 44–54 cm",
    );
    expect(rows[1]).toHaveTextContent("Gym equipment");
    expect(rows[1]).not.toHaveTextContent("Sample");
    expect(rows[1]).toHaveTextContent("Low stock");
  });

  it("shows the sample banner only when there are samples", () => {
    renderAdmin({ sampleCount: 8 });
    expect(
      screen.getByText(
        "8 of these products are samples. Edit them with real details or delete them, then publish.",
      ),
    ).toBeVisible();
    cleanup();
    renderAdmin({ sampleCount: 0 });
    expect(screen.queryByText(/are samples/)).not.toBeInTheDocument();
  });

  it("has an empty state for no products, and for a search with no matches", () => {
    renderAdmin({ products: [], totalCount: 0, sampleCount: 0 });
    expect(screen.getByText("No products yet")).toBeVisible();
    expect(
      screen.getByText("Use Add product to list your first item."),
    ).toBeVisible();
    cleanup();
    renderAdmin({ products: [], q: "lamp" });
    expect(screen.getByText("No products match “lamp”")).toBeVisible();
  });

  it("links Add product to the editor, keeping the search", () => {
    renderAdmin({ q: "chair" });
    expect(screen.getByRole("link", { name: "Add product" })).toHaveAttribute(
      "href",
      "/admin?q=chair&new=1",
    );
  });

  it("searches as you type, debounced, without scrolling", () => {
    vi.useFakeTimers();
    renderAdmin();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search products" }),
      { target: { value: "bench" } },
    );
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(replace).toHaveBeenCalledWith("/admin?q=bench", { scroll: false });
  });

  it("opens the editor through the URL", () => {
    renderAdmin({ q: "chair" });
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Ergonomic mesh chair" }),
    );
    expect(push).toHaveBeenCalledWith(`/admin?q=chair&edit=${CHAIR.id}`, {
      scroll: false,
    });
  });

  it("confirms a delete, calls the action and shows its message", async () => {
    const deleteAction = vi.fn(async () => ({
      ok: true,
      message: "Deleted Ergonomic mesh chair.",
    }));
    renderAdmin({ deleteAction });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Ergonomic mesh chair" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Delete Ergonomic mesh chair?",
    });
    expect(dialog).toHaveTextContent(
      "It will be removed from the store when you publish.",
    );
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete product" }),
      );
    });
    expect(deleteAction).toHaveBeenCalledWith(CHAIR.id);
    expect(snackbar()).toHaveTextContent("Deleted Ergonomic mesh chair.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the action's message when the product was already gone", async () => {
    renderAdmin({
      deleteAction: async () => ({
        ok: false,
        message: "That product no longer exists.",
      }),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Adjustable FID bench" }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete product" }));
    });
    expect(snackbar()).toHaveTextContent("That product no longer exists.");
  });

  it("cancelling a delete calls nothing", () => {
    const props = renderAdmin();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Ergonomic mesh chair" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.deleteAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reports an edit link for a product that's gone, and clears it", () => {
    renderAdmin({ missingProduct: true, q: "chair" });
    expect(snackbar()).toHaveTextContent("That product no longer exists.");
    expect(replace).toHaveBeenCalledWith("/admin?q=chair", { scroll: false });
  });

  it("opens the editor when the URL asks for it", () => {
    renderAdmin({ editor: { mode: "edit", product: CHAIR } });
    expect(screen.getByRole("dialog", { name: "Edit product" })).toBeVisible();
  });
});
