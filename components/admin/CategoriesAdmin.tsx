"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { CategoryRow } from "@/components/ui/CategoryRow";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { useSnackbar } from "@/components/ui/Snackbar";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/shared/cx";
import { CATEGORY_NOT_FOUND } from "@/lib/domain/schemas";
import type { Category, CategoryWithCount } from "@/lib/domain/types";
import type {
  DeleteCategoryAction,
  MoveCategoryAction,
  SaveCategoryAction,
} from "./actionTypes";
import { categoriesUrl } from "./adminUrl";
import styles from "./CategoriesAdmin.module.css";
import { CategoryEditor } from "./CategoryEditor";
import emptyStyles from "./EmptyState.module.css";

export type CategoryEditorState =
  { mode: "add" } | { mode: "edit"; category: Category };

export type CategoriesAdminProps = {
  /** In storefront order. */
  categories: CategoryWithCount[];
  /** From `?new=1` or `?edit=<id>`. */
  editor: CategoryEditorState | null;
  /** `?edit=` named a category that doesn't exist (any more). */
  missingCategory: boolean;
  saveAction: SaveCategoryAction;
  deleteAction: DeleteCategoryAction;
  moveAction: MoveCategoryAction;
};

const products = (n: number) => `${n} ${n === 1 ? "product" : "products"}`;

/**
 * The Categories tab (Figma 12:968): the list with move up and down buttons (the order
 * sets the storefront order and tone colors), the editor (12:1030) and the delete
 * dialog, which asks where a category's products should go.
 */
export function CategoriesAdmin({
  categories,
  editor,
  missingCategory,
  saveAction,
  deleteAction,
  moveAction,
}: CategoriesAdminProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const [moving, startMove] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [toDelete, setToDelete] = useState<CategoryWithCount | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  // `?edit=` for a category that's gone: say so once, and drop it from the URL.
  const reportedMissing = useRef(false);
  useEffect(() => {
    if (!missingCategory) {
      reportedMissing.current = false;
      return;
    }
    if (reportedMissing.current) return;
    reportedMissing.current = true;
    snackbar.show(CATEGORY_NOT_FOUND);
    router.replace(categoriesUrl(), { scroll: false });
  }, [missingCategory, router, snackbar]);

  // The editor closes at once; the URL catches up. `closedKey` hides it meanwhile.
  const editorKey = editor
    ? editor.mode === "edit"
      ? editor.category.id
      : "new"
    : null;
  const [closedKey, setClosedKey] = useState<string | null>(null);
  if (!editorKey && closedKey !== null) setClosedKey(null);

  function closeEditor() {
    setClosedKey(editorKey);
    router.replace(categoriesUrl(), { scroll: false });
  }

  function move(category: CategoryWithCount, direction: "up" | "down") {
    if (moving) return;
    startMove(async () => {
      const result = await moveAction(category.id, direction);
      if ("message" in result) {
        snackbar.show(result.message);
        return;
      }
      // Keep the keyboard on the row that moved. At the top or bottom its button is now
      // disabled, so focus its other one.
      requestAnimationFrame(() => {
        const label = (d: string) => `Move ${category.name} ${d}`;
        const button = (d: string) =>
          listRef.current?.querySelector<HTMLButtonElement>(
            `button[aria-label="${CSS.escape(label(d))}"]`,
          );
        const same = button(direction);
        const other = button(direction === "up" ? "down" : "up");
        (same && !same.disabled ? same : other)?.focus();
      });
    });
  }

  function openDelete(category: CategoryWithCount) {
    setMoveTo(categories.find((c) => c.id !== category.id)?.id ?? "");
    setToDelete(category);
  }

  function confirmDelete() {
    const category = toDelete;
    if (!category) return;
    startDelete(async () => {
      const result = await deleteAction(
        category.id,
        category.productCount > 0 ? moveTo : undefined,
      );
      setToDelete(null);
      snackbar.show(result.message);
    });
  }

  const others = toDelete ? categories.filter((c) => c.id !== toDelete.id) : [];
  const count = toDelete?.productCount ?? 0;
  // The only category, still with products: nothing to move them to.
  const stuck = count > 0 && others.length === 0;
  const them = count === 1 ? "it" : "them";

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className="t-title-large">Categories</h1>
        <Button
          href={categoriesUrl({ isNew: true })}
          prefetch={false}
          icon="add"
        >
          Add category
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className={emptyStyles.empty}>
          <Icon name="category" size={40} />
          <strong className="t-title-medium">No categories</strong>
          <p className={cx(emptyStyles.text, "t-body-medium")}>
            Add one before adding products.
          </p>
        </div>
      ) : (
        <ul
          ref={listRef}
          className={cx(styles.list, moving && styles.pending)}
          aria-label="Categories"
          aria-busy={moving || undefined}
        >
          {categories.map((category, index) => (
            <li key={category.id}>
              <CategoryRow
                name={category.name}
                productCount={category.productCount}
                blurb={category.blurb}
                icon={category.icon}
                toneIndex={index}
                canMoveUp={index > 0}
                canMoveDown={index < categories.length - 1}
                onMove={(direction) => move(category, direction)}
                onEdit={() =>
                  router.push(categoriesUrl({ edit: category.id }), {
                    scroll: false,
                  })
                }
                onDelete={() => openDelete(category)}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={toDelete !== null}
        onClose={() => {
          if (!deleting) setToDelete(null);
        }}
        title={toDelete ? `Delete ${toDelete.name}?` : ""}
        showClose={false}
        fullScreenOnMobile={false}
        actions={
          stuck ? (
            <Button onClick={() => setToDelete(null)}>OK</Button>
          ) : (
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
                Delete category
              </Button>
            </>
          )
        }
      >
        {toDelete && (
          <div className={styles.dialogBody}>
            {stuck ? (
              <p className={styles.text}>
                {toDelete.name} still has {products(count)} and there&apos;s no
                other category to move {them} to. Add another category first, or
                delete the products.
              </p>
            ) : count > 0 ? (
              <>
                <p className={styles.text}>
                  {toDelete.name} has {products(count)}. Choose where to move{" "}
                  {them}.
                </p>
                <TextField
                  kind="select"
                  label="Move products to"
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                >
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </TextField>
              </>
            ) : (
              <p className={styles.text}>
                {toDelete.name} has no products. It will be removed from the
                store.
              </p>
            )}
          </div>
        )}
      </Dialog>

      {editor && editorKey && (
        <CategoryEditor
          key={editorKey}
          open={closedKey !== editorKey}
          category={editor.mode === "edit" ? editor.category : null}
          saveAction={saveAction}
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
