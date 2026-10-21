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
});
