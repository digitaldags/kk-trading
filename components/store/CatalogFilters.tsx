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

  function navigate(next: { category?: string | null; q?: string | null }) {
    const current = new URLSearchParams(window.location.search);
    const url = buildCatalogUrl({
      category:
        next.category !== undefined ? next.category : current.get("category"),
      q: next.q !== undefined ? next.q : current.get("q"),
    });
    startTransition(() => router.replace(url, { scroll: false }));
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
      >
        {children}
      </div>
    </>
  );
}
