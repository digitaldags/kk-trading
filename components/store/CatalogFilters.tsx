"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useTransition,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { FilterChip } from "@/components/ui/FilterChip";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/shared/cx";
import { buildCatalogUrl } from "./catalogUrl";
import styles from "./CatalogFilters.module.css";

export const SEARCH_DEBOUNCE_MS = 250;

type CatalogFiltersProps = {
  categories: { slug: string; name: string }[];
  /** The selected category slug, if any. */
  category?: string;
  q?: string;
  /** The results. Dimmed while a new filter loads. */
  children: ReactNode;
};

/**
 * Category chips and search. Both are plain GET forms, so they work without
 * JavaScript. With it, they update the URL in place (`router.replace`, no scroll)
 * and the server renders the new results.
 */
export function CatalogFilters({
  categories,
  category,
  q,
  children,
}: CatalogFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Back and forward change `q` from outside. Don't overwrite what someone is typing.
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input) input.value = q ?? "";
  }, [q]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // A product opened while a filter change was still on its way (see handleResultsClick).
  const productHrefRef = useRef<string | null>(null);
  useEffect(() => {
    const href = productHrefRef.current;
    if (pending || !href) return;
    productHrefRef.current = null;
    router.push(href, { scroll: false });
  }, [pending, router]);

  function catalogUrl(next: { category?: string | null; q?: string | null }) {
    const current = new URLSearchParams(window.location.search);
    return buildCatalogUrl({
      category:
        next.category !== undefined ? next.category : current.get("category"),
      q: next.q !== undefined ? next.q : current.get("q"),
    });
  }

  function navigate(next: { category?: string | null; q?: string | null }) {
    // A debounced search firing after the visitor left the storefront (e.g. opened a
    // product) would replace that page's history entry.
    if (window.location.pathname !== "/") return;
    const url = catalogUrl(next);
    startTransition(() => router.replace(url, { scroll: false }));
  }

  /**
   * A product link clicked while a search is still debouncing or a filter is still
   * loading: apply the filter first, then open the product. Otherwise the product's
   * navigation cancels the filter (or the debounced search replaces the product's URL),
   * and closing the dialog goes back past the search. Runs in the capture phase, before
   * the link's own handler, which skips prevented clicks.
   */
  function handleResultsClick(event: MouseEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href^='/products/']")
        : null;
    const href = link?.getAttribute("href");
    if (!href) return;

    const url = catalogUrl({ q: inputRef.current?.value ?? null });
    const applied = url === window.location.pathname + window.location.search;
    if (applied && !pending) return;

    event.preventDefault();
    clearTimeout(timerRef.current);
    productHrefRef.current = href;
    if (!applied) startTransition(() => router.replace(url, { scroll: false }));
  }

  function selectCategory(event: MouseEvent<HTMLButtonElement>, slug: string) {
    event.preventDefault();
    clearTimeout(timerRef.current);
    navigate({ category: slug || null, q: inputRef.current?.value ?? null });
  }

  function handleSearchInput(value: string) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => navigate({ q: value }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTimeout(timerRef.current);
    navigate({ q: inputRef.current?.value ?? null });
  }

  const chips = [{ slug: "", name: "All" }, ...categories];

  return (
    <>
      <div className={styles.filters}>
        <form action="/" method="get" className={styles.chipForm}>
          {q && <input type="hidden" name="q" value={q} />}
          <div
            role="group"
            aria-label="Filter by category"
            className={styles.chips}
          >
            {chips.map((c) => (
              <FilterChip
                key={c.slug || "all"}
                type="submit"
                name="category"
                value={c.slug}
                selected={(category ?? "") === c.slug}
                onClick={(event) => selectCategory(event, c.slug)}
              >
                {c.name}
              </FilterChip>
            ))}
          </div>
        </form>

        <form
          action="/"
          method="get"
          role="search"
          className={styles.search}
          onSubmit={handleSearchSubmit}
        >
          {category && <input type="hidden" name="category" value={category} />}
          <Icon name="search" />
          <label htmlFor={searchId} className="visually-hidden">
            Search products
          </label>
          <input
            ref={inputRef}
            id={searchId}
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search products"
            autoComplete="off"
            enterKeyHint="search"
            className={cx(styles.input, "t-body-large")}
            onChange={(event) => handleSearchInput(event.target.value)}
          />
        </form>
      </div>

      <div
        className={cx(styles.results, pending && styles.pending)}
        aria-busy={pending || undefined}
        onClickCapture={handleResultsClick}
      >
        {children}
      </div>
    </>
  );
}
