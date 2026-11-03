// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppBar } from "./AppBar";
import { GYM, OFFICE } from "./testing/fixtures";

afterEach(cleanup);

describe("AppBar", () => {
  it("leads back to the storefront from other pages", () => {
    render(
      <AppBar
        storeName="KK Trading"
        categories={[OFFICE, GYM]}
        onStorefront={false}
      />,
    );
    expect(
      screen.getByRole("link", { name: "KK Trading, home" }),
    ).toHaveAttribute("href", "/");
    const nav = within(screen.getByRole("navigation", { name: "Sections" }));
    expect(nav.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/#contact",
    );
    expect(nav.getByRole("link", { name: "Office equipment" })).toHaveAttribute(
      "href",
      "/?category=office#catalog",
    );
  });

  it("shows the icon tile when the store has no logo", () => {
    const { container } = render(
      <AppBar
        storeName="KK Trading"
        categories={[OFFICE, GYM]}
        logo={{ logoUrl: null, logoWidth: null, logoHeight: null }}
      />,
    );
    const brand = screen.getByRole("link", { name: "KK Trading, back to top" });
    expect(container.querySelector("img")).toBeNull();
    expect(brand).toHaveTextContent("storefront");
    expect(brand).toHaveTextContent("KK Trading");
  });

  it("shows the published logo in place of the tile, sized from its stored size (ticket 40)", () => {
    const logoUrl =
      "https://store.public.blob.vercel-storage.com/branding/kk-trading-logo.png";
    for (const onStorefront of [true, false]) {
      const { container, unmount } = render(
        <AppBar
          storeName="KK Trading"
          categories={[OFFICE, GYM]}
          onStorefront={onStorefront}
          logo={{ logoUrl, logoWidth: 400, logoHeight: 100 }}
        />,
      );
      const name = onStorefront
        ? "KK Trading, back to top"
        : "KK Trading, home";
      // The link's name stays the store's: the logo is decorative inside it.
      const brand = screen.getByRole("link", { name });
      const img = brand.querySelector("img")!;
      expect(img).toHaveAttribute("alt", "");
      expect(img).toHaveAttribute("width", "160");
      expect(img).toHaveAttribute("height", "40");
      expect(img.getAttribute("src")).toContain(encodeURIComponent(logoUrl));
      expect(brand).not.toHaveTextContent("storefront");
      expect(brand).toHaveTextContent("KK Trading");
      expect(container.querySelectorAll("img")).toHaveLength(1);
      unmount();
    }
  });

  it("gives a logo saved without a size the tile's 40 × 40 box", () => {
    render(
      <AppBar
        storeName="KK Trading"
        categories={[OFFICE, GYM]}
        logo={{
          logoUrl:
            "https://store.public.blob.vercel-storage.com/branding/old-logo.png",
          logoWidth: null,
          logoHeight: null,
        }}
      />,
    );
    const img = screen
      .getByRole("link", { name: "KK Trading, back to top" })
      .querySelector("img")!;
    expect(img).toHaveAttribute("width", "40");
    expect(img).toHaveAttribute("height", "40");
  });
});
