// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import { Storefront, type StorefrontProps } from "./Storefront";
import {
  BARBELL,
  BENCH,
  CHAIR,
  GYM,
  OFFICE,
  SETTINGS,
} from "./testing/fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

afterEach(cleanup);

function renderStorefront(overrides: Partial<StorefrontProps> = {}) {
  return render(
    <SnackbarProvider>
      <Storefront
        settings={SETTINGS}
        categories={[OFFICE, GYM]}
        products={[CHAIR, BENCH, BARBELL]}
        filter={{}}
        year={2026}
        {...overrides}
      />
    </SnackbarProvider>,
  );
}

const chipGroup = () =>
  screen.getByRole("group", { name: "Filter by category" });

describe("Storefront", () => {
  it("shows the store copy, product total and footer", () => {
    renderStorefront();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Equipment for the desk and the gym",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 products")).toBeInTheDocument();
    expect(screen.getByText("© 2026 KK Trading")).toBeInTheDocument();
  });

  it("selects the chip for the filtered category", () => {
    renderStorefront({ products: [CHAIR], filter: { categorySlug: "office" } });
    const chips = within(chipGroup());
    expect(
      chips.getByRole("button", { name: "Office equipment" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(chips.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("1 of 3 shown")).toBeInTheDocument();
  });

  it("selects All when there's no filter", () => {
    renderStorefront();
    expect(
      within(chipGroup()).getByRole("button", { name: "All" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("3 of 3 shown")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderStorefront({ products: [], filter: { q: "rowing" } });
    expect(screen.getByText("No products match")).toBeInTheDocument();
    expect(
      screen.getByText("Try another search or category."),
    ).toBeInTheDocument();
    expect(screen.getByText("0 of 3 shown")).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search products" }),
    ).toHaveValue("rowing");
  });

  it("links tiles and nav to the category filter", () => {
    renderStorefront();
    const nav = within(screen.getByRole("navigation", { name: "Sections" }));
    expect(nav.getByRole("link", { name: "Gym equipment" })).toHaveAttribute(
      "href",
      "/?category=gym#catalog",
    );
    expect(nav.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "#contact",
    );
    const tile = screen.getByRole("link", { name: /Office equipment.*1 item/ });
    expect(tile).toHaveAttribute("href", "/?category=office#catalog");
    expect(
      screen.getByRole("link", { name: /Gym equipment.*2 items/ }),
    ).toBeInTheDocument();
  });

  it("links the phone and email, and hides an empty address", () => {
    renderStorefront();
    expect(screen.getByRole("link", { name: "0917 000 0000" })).toHaveAttribute(
      "href",
      "tel:09170000000",
    );
    expect(
      screen.getByRole("link", { name: "hello@example.com" }),
    ).toHaveAttribute("href", "mailto:hello@example.com");
    expect(screen.queryByText("Address")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy phone" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy address" }),
    ).not.toBeInTheDocument();
  });

  it("links the admin button and the brand", () => {
    renderStorefront();
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(
      screen.getByRole("link", { name: "KK Trading, back to top" }),
    ).toHaveAttribute("href", "#top");
  });
});
