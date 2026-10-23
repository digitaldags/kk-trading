"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/shared/cx";
import type { CategoryIcon } from "@/lib/domain/icons";
import { fromZodError, type FieldErrors } from "@/lib/domain/result";
import { categoryInputSchema } from "@/lib/domain/schemas";
import type { Category } from "@/lib/domain/types";
import type { CategoryField, SaveCategoryAction } from "./actionTypes";
import styles from "./CategoryEditor.module.css";
import { IconPicker } from "./IconPicker";

/** Fields in the order they're shown, so the first error gets focus. */
const FIELD_ORDER: CategoryField[] = ["name", "blurb", "icon"];

type Fields = { name: string; blurb: string; icon: CategoryIcon };

type CategoryEditorProps = {
  open: boolean;
  /** Null adds a category. */
  category: Category | null;
  saveAction: SaveCategoryAction;
  onClose: () => void;
  /** After a save, with the snackbar message ("Added …" / "Saved …"). */
  onSaved: (message: string) => void;
};

/**
 * Add or edit a category (Figma 12:1030): name, short description and icon. Checked with
 * the shared zod schema first, then by the save action (which also catches a duplicate
 * name). Closing with unsaved edits asks first.
 */
export function CategoryEditor({
  open,
  category,
  saveAction,
  onClose,
  onSaved,
}: CategoryEditorProps) {
  const id = useId();
  const formId = `${id}-form`;
  const fieldId = (field: CategoryField) => `${id}-${field}`;

  const [initial] = useState<Fields>(() => ({
    name: category?.name ?? "",
    blurb: category?.blurb ?? "",
    icon: (category?.icon as CategoryIcon | undefined) ?? "category",
  }));
  const [fields, setFields] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors<CategoryField>>({});
  const [formError, setFormError] = useState<string>();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [saving, startSaving] = useTransition();

  const dirty = (Object.keys(initial) as (keyof Fields)[]).some(
    (key) => fields[key] !== initial[key],
  );

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function focusFirstError(found: FieldErrors<CategoryField>) {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) document.getElementById(fieldId(first))?.focus();
  }

  function requestClose() {
    if (saving) return;
    if (dirty) setConfirmingDiscard(true);
    else close();
  }

  function close() {
    setConfirmingDiscard(false);
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const parsed = categoryInputSchema.safeParse(fields);
    if (!parsed.success) {
      const found = fromZodError<CategoryField>(parsed.error).fieldErrors;
      setErrors(found);
      setFormError(undefined);
      focusFirstError(found);
      return;
    }
    setErrors({});
    setFormError(undefined);

    startSaving(async () => {
      const result = await saveAction({ id: category?.id, ...fields });
      if (result.ok) {
        onSaved(result.message);
        return;
      }
      setErrors(result.fieldErrors);
      setFormError(result.formError);
      focusFirstError(result.fieldErrors);
    });
  }

  const adding = category === null;

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title={adding ? "Add category" : "Edit category"}
        actions={
          <>
            <Button variant="text" disabled={saving} onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={saving}>
              {adding ? "Add category" : "Save changes"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className={styles.form}
          noValidate
          onSubmit={handleSubmit}
          aria-busy={saving || undefined}
        >
          <TextField
            id={fieldId("name")}
            label="Category name"
            value={fields.name}
            maxLength={40}
            required
            error={errors.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <TextField
            id={fieldId("blurb")}
            label="Short description"
            value={fields.blurb}
            maxLength={70}
            placeholder="e.g. Bars, benches, racks and free weights"
            error={errors.blurb}
            onChange={(e) => set("blurb", e.target.value)}
          />
          <IconPicker
            id={fieldId("icon")}
            value={fields.icon}
            error={errors.icon}
            onChange={(icon) => set("icon", icon)}
          />
          {formError && (
            <p role="alert" className={cx(styles.error, "t-body-small")}>
              {formError}
            </p>
          )}
        </form>
      </Dialog>

      <Dialog
        open={open && confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        title="Discard changes to this category?"
        showClose={false}
        fullScreenOnMobile={false}
        actions={
          <>
            <Button variant="text" onClick={() => setConfirmingDiscard(false)}>
              Keep editing
            </Button>
            <Button onClick={close}>Discard changes</Button>
          </>
        }
      >
        <p className={styles.text}>Your edits won&apos;t be saved.</p>
      </Dialog>
    </>
  );
}
