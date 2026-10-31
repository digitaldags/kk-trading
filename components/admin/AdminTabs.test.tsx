// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTabs } from "./AdminTabs";

let pathname = "/admin";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

afterEach(cleanup);

describe("AdminTabs", () => {
  it("links every section and marks the current one", () => {
    pathname = "/admin/categories";
    render(<AdminTabs />);
    const nav = screen.getByRole("navigation", { name: "Admin sections" });
    expect(nav).toBeVisible();
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByRole("link", { name: "Categories" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Store details" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("lists Documents last", () => {
    pathname = "/admin";
    render(<AdminTabs />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "inventory_2Products",
      "categoryCategories",
      "storefrontStore details",
      "descriptionDocuments",
    ]);
    expect(links[3]).toHaveAttribute("href", "/admin/documents");
  });

  it.each(["/admin/documents", "/admin/documents/abc", "/admin/documents/new"])(
    "marks Documents, and only Documents, on %s",
    (path) => {
      pathname = path;
      render(<AdminTabs />);
      expect(screen.getByRole("link", { name: "Documents" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(
        screen.getByRole("link", { name: "Products" }),
      ).not.toHaveAttribute("aria-current");
    },
  );

  it("matches whole path segments only", () => {
    pathname = "/admin/categoriesx";
    render(<AdminTabs />);
    expect(screen.queryByRole("link", { current: "page" })).toBeNull();
  });

  it("marks Products on /admin", () => {
    pathname = "/admin";
    render(<AdminTabs />);
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
