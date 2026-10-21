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
import {
  ProductsAdmin,
  SEARCH_DEBOUNCE_MS,
  type ProductsAdminProps,
} from "./ProductsAdmin";
import { adminProduct, GYM, OFFICE } from "./testing/fixtures";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

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
        "8 of these products are samples. Edit them with real details or delete them.",
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
      "It will be removed from the store right away.",
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
