// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import { ProductDetail, type ProductDetailProps } from "./ProductDetail";
import { CHAIR, DUMBBELLS, SETTINGS } from "./testing/fixtures";

afterEach(cleanup);

function renderDetail(overrides: Partial<ProductDetailProps> = {}) {
  return render(
    <SnackbarProvider>
      <ProductDetail
        product={DUMBBELLS}
        toneIndex={1}
        settings={SETTINGS}
        headingLevel="h1"
        {...overrides}
      />
    </SnackbarProvider>,
  );
}

describe("ProductDetail", () => {
  it("shows the category, name, price, status and key spec", () => {
    renderDetail();
    expect(screen.getByText("Gym equipment")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Rubber hex dumbbells, pair",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("₱2,600")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByText("2 × 10 kg · Chrome handles")).toBeInTheDocument();
  });

  it("keeps the line breaks in the description", () => {
    renderDetail();
    const description = screen.getByText(/Hexagonal heads/);
    expect(description.textContent).toBe(
      "Hexagonal heads stay put on the floor.\nSold as a pair.",
    );
  });

  it("uses the heading level and id it's given", () => {
    renderDetail({ headingLevel: "h2", titleId: "dialog-title" });
    expect(
      screen.getByRole("heading", { level: 2, name: /dumbbells/ }),
    ).toHaveAttribute("id", "dialog-title");
  });

  it("links the phone and email with copy buttons", () => {
    renderDetail();
    expect(
      screen.getByText("To order or ask about this item"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "0917 000 0000" })).toHaveAttribute(
      "href",
      "tel:09170000000",
    );
    expect(
      screen.getByRole("link", { name: "hello@example.com" }),
    ).toHaveAttribute("href", "mailto:hello@example.com");
    expect(screen.getByRole("button", { name: "Copy phone" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy email" })).toBeVisible();
  });

  it("hides an empty contact row, and the box when both are empty", () => {
    const { rerender } = renderDetail({ settings: { ...SETTINGS, phone: "" } });
    expect(
      screen.queryByRole("button", { name: "Copy phone" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy email" })).toBeVisible();

    rerender(
      <SnackbarProvider>
        <ProductDetail
          product={DUMBBELLS}
          toneIndex={1}
          settings={{ phone: "", email: "" }}
          headingLevel="h1"
        />
      </SnackbarProvider>,
    );
    expect(
      screen.queryByText("To order or ask about this item"),
    ).not.toBeInTheDocument();
  });

  it("shows the category icon when there's no photo, and skips empty text", () => {
    const { container } = renderDetail({ product: CHAIR, toneIndex: 0 });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("chair")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("In stock")).toBeInTheDocument();
    // CHAIR has no key spec or description, so the only paragraphs are the
    // category overline and the ask box title.
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("renders the action in the top row", () => {
    renderDetail({ action: <button type="button">Close</button> });
    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
  });
});
