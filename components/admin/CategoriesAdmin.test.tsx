// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import type { CategoryWithCount } from "@/lib/domain/types";
import { CategoriesAdmin, type CategoriesAdminProps } from "./CategoriesAdmin";
import { GYM, OFFICE } from "./testing/fixtures";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

const office: CategoryWithCount = {
  ...OFFICE,
  blurb: "Chairs, desks and storage",
  productCount: 4,
};
const gym: CategoryWithCount = { ...GYM, productCount: 1 };
const outdoor: CategoryWithCount = {
  ...GYM,
  id: "00000000-0000-4000-8000-000000000003",
  slug: "outdoor",
  name: "Outdoor",
  icon: "pool",
  sortOrder: 2,
  productCount: 0,
};

function renderAdmin(props: Partial<CategoriesAdminProps> = {}) {
  const all: CategoriesAdminProps = {
    categories: [office, gym, outdoor],
    editor: null,
    missingCategory: false,
    saveAction: vi.fn(),
    deleteAction: vi.fn(async () => ({ ok: true, message: "Deleted." })),
    moveAction: vi.fn(async () => ({ ok: true as const })),
    ...props,
  };
  render(
    <SnackbarProvider>
      <CategoriesAdmin {...all} />
    </SnackbarProvider>,
  );
  return all;
}

const snackbar = () => screen.getAllByRole("status").at(-1)!;

beforeEach(() => {
  replace.mockReset();
  push.mockReset();
});

afterEach(cleanup);

describe("CategoriesAdmin", () => {
  it("lists categories with their product count and description", () => {
    renderAdmin();
    const rows = within(
      screen.getByRole("list", { name: "Categories" }),
    ).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("4 products · Chairs, desks and storage"),
      expect.stringContaining("1 product"),
      expect.stringContaining("0 products"),
    ]);
    expect(screen.getByRole("link", { name: "Add category" })).toHaveAttribute(
      "href",
      "/admin/categories?new=1",
    );
  });

  it("can't move the first one up or the last one down", async () => {
    const { moveAction } = renderAdmin();
    expect(
      screen.getByRole("button", { name: "Move Office equipment up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Outdoor down" }),
    ).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Move Gym equipment up" }),
    );
    expect(moveAction).toHaveBeenCalledWith(gym.id, "up");
  });

  it("shows the empty state", () => {
    renderAdmin({ categories: [] });
    expect(screen.getByText("No categories")).toBeVisible();
    expect(screen.getByText("Add one before adding products.")).toBeVisible();
  });

  it("deletes a category without products after confirming", async () => {
    const { deleteAction } = renderAdmin();
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Outdoor" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Delete Outdoor?" });
    expect(dialog).toHaveTextContent(
      "Outdoor has no products. It will be removed from the store.",
    );
    expect(within(dialog).queryByLabelText("Move products to")).toBeNull();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete category" }),
    );
    expect(deleteAction).toHaveBeenCalledWith(outdoor.id, undefined);
    await waitFor(() => expect(snackbar()).toHaveTextContent("Deleted."));
  });

  it("asks where to move the products, then passes the choice on", async () => {
    const { deleteAction } = renderAdmin();
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Office equipment" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Delete Office equipment?",
    });
    expect(dialog).toHaveTextContent(
      "Office equipment has 4 products. Choose where to move them.",
    );
    const select = within(dialog).getByLabelText("Move products to");
    // Every other category, the first one chosen.
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Gym equipment", "Outdoor"]);
    expect(select).toHaveValue(gym.id);

    await userEvent.selectOptions(select, outdoor.id);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete category" }),
    );
    expect(deleteAction).toHaveBeenCalledWith(office.id, outdoor.id);
  });

  it("uses the singular for one product", async () => {
    renderAdmin();
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Gym equipment" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Delete Gym equipment?" }),
    ).toHaveTextContent(
      "Gym equipment has 1 product. Choose where to move it.",
    );
  });

  it("explains that the only category with products can't be deleted yet", async () => {
    const { deleteAction } = renderAdmin({ categories: [office] });
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Office equipment" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Delete Office equipment?",
    });
    expect(dialog).toHaveTextContent(
      "Office equipment still has 4 products and there's no other category to move them to. Add another category first, or delete the products.",
    );
    expect(
      within(dialog).queryByRole("button", { name: "Delete category" }),
    ).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(deleteAction).not.toHaveBeenCalled();
  });

  it("shows a failed delete's message", async () => {
    renderAdmin({
      deleteAction: vi.fn(async () => ({
        ok: false,
        message: "That category no longer exists.",
      })),
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Outdoor" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Delete category" }),
    );
    await waitFor(() =>
      expect(snackbar()).toHaveTextContent("That category no longer exists."),
    );
  });

  it("says so when ?edit= names a category that's gone", () => {
    renderAdmin({ missingCategory: true });
    expect(snackbar()).toHaveTextContent("That category no longer exists.");
    expect(replace).toHaveBeenCalledWith("/admin/categories", {
      scroll: false,
    });
  });
});
