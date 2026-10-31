"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FilterChip } from "@/components/ui/FilterChip";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/shared/cx";
import type { Category, ProductWithCategory } from "@/lib/domain/types";
import { formatPeso } from "@/lib/format";
import styles from "./AddProductDialog.module.css";
import { ProductThumb } from "./QuotationItemRow";

export type AddProductDialogProps = {
  open: boolean;
  /** The live catalog (the admin's draft), not the published store. */
  products: ProductWithCategory[];
  categories: Category[];
  /** Products already on the quotation: shown as Added. */
  addedIds: ReadonlySet<string>;
  onAdd: (product: ProductWithCategory) => void;
  onClose: () => void;
};

/**
 * Add product (Figma 76:1026): search and category chips over the catalog. Each product
 * goes on once, at its catalog price; the quotation then edits quantity and price.
 */
export function AddProductDialog({
  open,
  products,
  categories,
  addedIds,
  onAdd,
  onClose,
}: AddProductDialogProps) {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const searchId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const doneId = useId();

  const needle = q.trim().toLowerCase();
  const shown = products.filter(
    (p) =>
      (!categoryId || p.categoryId === categoryId) &&
      (!needle ||
        p.name.toLowerCase().includes(needle) ||
        p.code.toLowerCase().includes(needle)),
  );

  function add(product: ProductWithCategory) {
    onAdd(product);
    // The pressed button turns into "Added" (disabled), so move focus on: to the next
    // product that can still be added, or to Done.
    requestAnimationFrame(() => {
      const next = listRef.current?.querySelector<HTMLButtonElement>(
        "button:not([disabled])",
      );
      (next ?? document.getElementById(doneId))?.focus();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add product"
      size="wide"
      actions={
        <Button id={doneId} onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className={styles.body}>
        <div className={styles.search} role="search">
          <Icon name="search" />
          <label htmlFor={searchId} className="visually-hidden">
            Search by name or code
          </label>
          <input
            id={searchId}
            type="search"
            value={q}
            placeholder="Search by name or code"
            autoComplete="off"
            className={cx(styles.searchInput, "t-body-large")}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>

        <div
          role="group"
          aria-label="Filter by category"
          className={styles.chips}
        >
          <FilterChip
            selected={categoryId === null}
            onClick={() => setCategoryId(null)}
          >
            All
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              selected={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </FilterChip>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className={cx(styles.empty, "t-body-medium")}>
            {needle
              ? `No products match “${q.trim()}”.`
              : "No products in this category."}
          </p>
        ) : (
          <ul ref={listRef} className={styles.list} aria-label="Products">
            {shown.map((product) => {
              const added = addedIds.has(product.id);
              const price = formatPeso(product.priceCentavos);
              return (
                <li key={product.id} className={styles.row}>
                  <ProductThumb
                    imageUrl={product.imageUrl}
                    icon={product.category.icon}
                  />
                  <div className={styles.text}>
                    <p className={cx(styles.name, "t-body-large")}>
                      {product.name}
                    </p>
                    <p className={cx(styles.meta, "t-body-medium")}>
                      {product.code ? `${product.code} · ${price}` : price}
                    </p>
                  </div>
                  {added ? (
                    <Button
                      variant="text"
                      icon="check"
                      disabled
                      aria-label={`Added ${product.name}`}
                    >
                      Added
                    </Button>
                  ) : (
                    <Button
                      variant="tonal"
                      aria-label={`Add ${product.name}`}
                      onClick={() => add(product)}
                    >
                      Add
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className={cx(styles.hint, "t-body-small")}>
          Each product is added once at its catalog price. Change the quantity
          and price on the quotation.
        </p>
      </div>
    </Dialog>
  );
}
