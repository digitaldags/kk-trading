"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { ProductRow } from "@/components/ui/ProductRow";
import { useSnackbar } from "@/components/ui/Snackbar";
import { cx } from "@/components/ui/shared/cx";
import { PRODUCT_NOT_FOUND } from "@/lib/domain/schemas";
import type {
  Category,
  Product,
  ProductWithCategory,
} from "@/lib/domain/types";
import type {
  DeleteProductAction,
  DiscardUploadAction,
  SaveProductAction,
} from "./actionTypes";
import { productsUrl } from "./adminUrl";
import emptyStyles from "./EmptyState.module.css";
import { ProductEditor } from "./ProductEditor";
import styles from "./ProductsAdmin.module.css";

export const SEARCH_DEBOUNCE_MS = 250;

export type EditorState = { mode: "add" } | { mode: "edit"; product: Product };

export type ProductsAdminProps = {
  /** The products matching `q`. */
  products: ProductWithCategory[];
  /** Every product, whatever the search. */
  totalCount: number;
  sampleCount: number;
  categories: Category[];
  q: string;
  /** From `?new=1` or `?edit=<id>`. */
  editor: EditorState | null;
  /** `?edit=` named a product that doesn't exist (any more). */
  missingProduct: boolean;
  deleteAction: DeleteProductAction;
  saveAction: SaveProductAction;
  discardUploadAction: DiscardUploadAction;
};

/**
 * The Products tab (Figma 12:301): sample banner, search, Add product, the list, the
 * delete confirmation (12:761) and the editor (12:509). Search is a plain GET form that
 * updates the URL in place with JavaScript, like the storefront's.
 */
export function ProductsAdmin({
  products,
  totalCount,
  sampleCount,
  categories,
  q,
  editor,
  missingProduct,
  deleteAction,
  saveAction,
  discardUploadAction,
}: ProductsAdminProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const [searching, startSearch] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [toDelete, setToDelete] = useState<ProductWithCategory | null>(null);
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toneIndex = (categoryId: string) =>
    Math.max(
      0,
      categories.findIndex((c) => c.id === categoryId),
    );

  // Back and forward change `q` from outside. Don't overwrite what someone is typing.
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input) input.value = q;
  }, [q]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // `?edit=` for a product that's gone (an old link, or deleted elsewhere): say so once,
  // and drop it from the URL.
  const reportedMissing = useRef(false);
  useEffect(() => {
    if (!missingProduct) {
      reportedMissing.current = false;
      return;
    }
    if (reportedMissing.current) return;
    reportedMissing.current = true;
    snackbar.show(PRODUCT_NOT_FOUND);
    router.replace(productsUrl({ q }), { scroll: false });
  }, [missingProduct, q, router, snackbar]);

  // The editor closes at once; the URL catches up. `closedKey` hides it meanwhile.
  const editorKey = editor
    ? editor.mode === "edit"
      ? editor.product.id
      : "new"
    : null;
  const [closedKey, setClosedKey] = useState<string | null>(null);
  // Once the URL has no editor, forget it, so the same product can open again.
  if (!editorKey && closedKey !== null) setClosedKey(null);

  function closeEditor() {
    setClosedKey(editorKey);
    router.replace(productsUrl({ q: currentQuery() }), { scroll: false });
  }

  function currentQuery() {
    return inputRef.current?.value ?? q;
  }

  function search(value: string) {
    // A debounced search firing after the editor opened would drop it from the URL.
    const params = new URLSearchParams(window.location.search);
    if (params.has("edit") || params.has("new")) return;
    startSearch(() =>
      router.replace(productsUrl({ q: value }), { scroll: false }),
    );
  }

  function handleSearchInput(value: string) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), SEARCH_DEBOUNCE_MS);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTimeout(timerRef.current);
    search(currentQuery());
  }

  function openEditor(id: string) {
    clearTimeout(timerRef.current);
    router.push(productsUrl({ q: currentQuery(), edit: id }), {
      scroll: false,
    });
  }

  function confirmDelete() {
    const product = toDelete;
    if (!product) return;
    startDelete(async () => {
      const result = await deleteAction(product.id);
      setToDelete(null);
      snackbar.show(result.message);
    });
  }

  return (
    <>
      {sampleCount > 0 && (
        <Banner className={styles.banner}>
          {sampleCount} of these products are samples. Edit them with real
          details or delete them.
        </Banner>
      )}

      <div className={styles.toolbar}>
        <form
          action="/admin"
          method="get"
          role="search"
          className={styles.search}
          onSubmit={handleSearchSubmit}
        >
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
            className={cx(styles.searchInput, "t-body-large")}
            onChange={(event) => handleSearchInput(event.target.value)}
          />
        </form>
        <Button
          href={productsUrl({ q, isNew: true })}
          prefetch={false}
          icon="add"
        >
          Add product
        </Button>
      </div>

      <div
        className={cx(styles.results, searching && styles.pending)}
        aria-busy={searching || undefined}
      >
        {totalCount === 0 ? (
          <div className={emptyStyles.empty}>
            <Icon name="inventory_2" size={40} />
            <strong className="t-title-medium">No products yet</strong>
            <p className={cx(emptyStyles.text, "t-body-medium")}>
              Use Add product to list your first item.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className={emptyStyles.empty}>
            <Icon name="search_off" size={40} />
            <strong className="t-title-medium">
              No products match &ldquo;{q}&rdquo;
            </strong>
          </div>
        ) : (
          <ul className={styles.list} aria-label="Products">
            {products.map((product) => (
              <li key={product.id}>
                <ProductRow
                  name={product.name}
                  subtitle={[product.category.name, product.keySpec]
                    .filter(Boolean)
                    .join(" · ")}
                  priceCentavos={product.priceCentavos}
                  status={product.stockStatus}
                  sample={product.isSample}
                  imageUrl={product.imageUrl}
                  icon={product.category.icon}
                  toneIndex={toneIndex(product.categoryId)}
                  onEdit={() => openEditor(product.id)}
                  onDelete={() => setToDelete(product)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={toDelete !== null}
        onClose={() => {
          if (!deleting) setToDelete(null);
        }}
        title={toDelete ? `Delete ${toDelete.name}?` : ""}
        showClose={false}
        fullScreenOnMobile={false}
        actions={
          <>
            <Button
              variant="text"
              disabled={deleting}
              onClick={() => setToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleting}
              onClick={confirmDelete}
            >
              Delete product
            </Button>
          </>
        }
      >
        <p className={styles.dialogText}>
          It will be removed from the store right away.
        </p>
      </Dialog>

      {editor && editorKey && (
        <ProductEditor
          key={editorKey}
          open={closedKey !== editorKey}
          product={editor.mode === "edit" ? editor.product : null}
          categories={categories}
          saveAction={saveAction}
          discardUploadAction={discardUploadAction}
          onClose={closeEditor}
          onSaved={(message) => {
            snackbar.show(message);
            closeEditor();
          }}
        />
      )}
    </>
  );
}
