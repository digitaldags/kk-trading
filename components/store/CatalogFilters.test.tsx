// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogFilters, SEARCH_DEBOUNCE_MS } from "./CatalogFilters";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const CATEGORIES = [
  { slug: "office", name: "Office equipment" },
  { slug: "gym", name: "Gym equipment" },
];

function renderFilters(props: { category?: string; q?: string } = {}) {
  window.history.replaceState(
    null,
    "",
    `/?${new URLSearchParams(
      Object.entries(props).filter(([, v]) => v) as [string, string][],
    )}`,
  );
  return render(
    <CatalogFilters categories={CATEGORIES} {...props}>
      <p>Results</p>
    </CatalogFilters>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CatalogFilters", () => {
  it("replaces the URL without scrolling when a chip is clicked", () => {
    renderFilters({ q: "bench" });
    fireEvent.click(screen.getByRole("button", { name: "Gym equipment" }));
    expect(replace).toHaveBeenCalledWith("/?category=gym&q=bench", {
      scroll: false,
    });
  });

  it("clears the category with All", () => {
    renderFilters({ category: "gym" });
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("debounces typing into one URL update", () => {
    renderFilters({ category: "gym" });
    const search = screen.getByRole("searchbox", { name: "Search products" });
    fireEvent.change(search, { target: { value: "b" } });
    fireEvent.change(search, { target: { value: "be" } });
    fireEvent.change(search, { target: { value: "bench" } });

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/?category=gym&q=bench", {
      scroll: false,
    });
  });

  it("searches right away on Enter", () => {
    renderFilters();
    const search = screen.getByRole("searchbox", { name: "Search products" });
    fireEvent.change(search, { target: { value: "rack" } });
    fireEvent.submit(search.closest("form")!);
    expect(replace).toHaveBeenCalledWith("/?q=rack", { scroll: false });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("works as plain GET forms without JavaScript", () => {
    renderFilters({ category: "gym", q: "bench" });
    const chip = screen.getByRole("button", { name: "Office equipment" });
    expect(chip).toHaveAttribute("type", "submit");
    expect(chip).toHaveAttribute("name", "category");
    expect(chip).toHaveAttribute("value", "office");
    expect(chip.closest("form")).toHaveAttribute("method", "get");
    const search = screen.getByRole("searchbox", { name: "Search products" });
    expect(search).toHaveAttribute("name", "q");
    expect(
      search.closest("form")?.querySelector('input[name="category"]'),
    ).toHaveValue("gym");
  });
});
