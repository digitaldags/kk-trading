"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { SegmentedButtons } from "@/components/ui/SegmentedButtons";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/shared/cx";
import { PRODUCT_IMAGE_PREFIX } from "@/lib/domain/productImages";
import { fromZodError, type FieldErrors } from "@/lib/domain/result";
import { productInputSchema } from "@/lib/domain/schemas";
import { slugify } from "@/lib/domain/slug";
import {
  STOCK_LABELS,
  STOCK_STATUSES,
  type StockStatus,
} from "@/lib/domain/stock";
import type { Category, Product } from "@/lib/domain/types";
import type {
  DiscardUploadAction,
  ProductField,
  SaveProductAction,
} from "./actionTypes";
import styles from "./ProductEditor.module.css";
import { ImageFileError, resizeImage, UNREADABLE_IMAGE } from "./resizeImage";

export const UPLOAD_URL = "/api/blob/upload";
export const UPLOAD_FAILED = "The photo couldn't be uploaded. Try again.";

const STOCK_OPTIONS = STOCK_STATUSES.map((value) => ({
  value,
  label: STOCK_LABELS[value],
}));

/** Fields in the order they're shown, so the first error gets focus. */
const FIELD_ORDER: ProductField[] = [
  "name",
  "categoryId",
  "price",
  "stockStatus",
  "keySpec",
  "description",
  "image",
];

const fieldsSchema = productInputSchema.omit({ image: true });

type Fields = {
  name: string;
  categoryId: string;
  price: string;
  stockStatus: StockStatus;
  keySpec: string;
  description: string;
};

/** The photo as the editor shows it. `uploaded` is set once a new photo is in Blob. */
type Photo =
  | { kind: "current"; url: string }
  | { kind: "none" }
  | {
      kind: "new";
      file: Blob;
      previewUrl: string;
      uploaded?: { url: string; pathname: string };
    };

type ProductEditorProps = {
  open: boolean;
  /** Null adds a product. */
  product: Product | null;
  categories: Category[];
  saveAction: SaveProductAction;
  discardUploadAction: DiscardUploadAction;
  onClose: () => void;
  /** After a save, with the snackbar message ("Added …" / "Saved …"). */
  onSaved: (message: string) => void;
};

/** "8950" for ₱8,950, "8950.50" for ₱8,950.50: what the owner would type. */
export function priceInputValue(centavos: number): string {
  return centavos % 100 === 0
    ? String(centavos / 100)
    : (centavos / 100).toFixed(2);
}

function initialFields(
  product: Product | null,
  categories: Category[],
): Fields {
  return {
    name: product?.name ?? "",
    categoryId: product?.categoryId ?? categories[0]?.id ?? "",
    price: product ? priceInputValue(product.priceCentavos) : "",
    stockStatus: product?.stockStatus ?? "in_stock",
    keySpec: product?.keySpec ?? "",
    description: product?.description ?? "",
  };
}

/**
 * Add or edit a product (Figma 12:509). Fields are checked with the shared zod schema
 * before anything is uploaded, then a new photo goes straight to Vercel Blob
 * (`/api/blob/upload` signs it), then the save action writes the row. Closing with
 * unsaved edits asks first.
 */
export function ProductEditor({
  open,
  product,
  categories,
  saveAction,
  discardUploadAction,
  onClose,
  onSaved,
}: ProductEditorProps) {
  const id = useId();
  const formId = `${id}-form`;
  const fieldId = (field: ProductField) => `${id}-${field}`;
  const photoButtonId = fieldId("image");

  const [initial] = useState(() => initialFields(product, categories));
  const [fields, setFields] = useState(initial);
  const initialPhoto: Photo = product?.imageUrl
    ? { kind: "current", url: product.imageUrl }
    : { kind: "none" };
  const [photo, setPhoto] = useState<Photo>(initialPhoto);
  const [errors, setErrors] = useState<FieldErrors<ProductField>>({});
  const [formError, setFormError] = useState<string>();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [saving, startSaving] = useTransition();
  // A photo in Blob that no product uses yet. Deleted if the editor closes without saving.
  const unsavedUploadRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewUrl = photo.kind === "new" ? photo.previewUrl : null;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const dirty =
    (Object.keys(initial) as (keyof Fields)[]).some(
      (key) => fields[key] !== initial[key],
    ) || photo.kind !== initialPhoto.kind;

  const category = categories.find((c) => c.id === fields.categoryId);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function focusFirstError(found: FieldErrors<ProductField>) {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (!first) return;
    // The stock group has no single control; its first button stands in.
    const target =
      first === "stockStatus"
        ? document.querySelector<HTMLElement>(
            `#${CSS.escape(fieldId(first))} button`,
          )
        : document.getElementById(fieldId(first));
    target?.focus();
  }

  function requestClose() {
    if (saving) return;
    if (dirty) setConfirmingDiscard(true);
    else close();
  }

  function close() {
    const unsaved = unsavedUploadRef.current;
    if (unsaved) {
      unsavedUploadRef.current = null;
      void discardUploadAction(unsaved);
    }
    setConfirmingDiscard(false);
    onClose();
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be picked again after Remove.
    event.target.value = "";
    if (!file) return;
    try {
      const resized = await resizeImage(file);
      setPhoto({
        kind: "new",
        file: resized,
        previewUrl: URL.createObjectURL(resized),
      });
      setErrors(({ image: _, ...rest }) => rest);
    } catch (error) {
      setErrors((e) => ({
        ...e,
        image:
          error instanceof ImageFileError ? error.message : UNREADABLE_IMAGE,
      }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const parsed = fieldsSchema.safeParse(fields);
    if (!parsed.success) {
      const found = fromZodError<ProductField>(parsed.error).fieldErrors;
      setErrors(found);
      setFormError(undefined);
      focusFirstError(found);
      return;
    }
    setErrors({});
    setFormError(undefined);

    startSaving(async () => {
      let image: { url: string; pathname: string } | null | undefined;
      if (photo.kind === "new") {
        image = photo.uploaded;
        if (!image) {
          try {
            const extension = photo.file.type === "image/webp" ? "webp" : "jpg";
            const blob = await upload(
              `${PRODUCT_IMAGE_PREFIX}${slugify(fields.name, "product")}.${extension}`,
              photo.file,
              {
                access: "public",
                handleUploadUrl: UPLOAD_URL,
                contentType: photo.file.type,
              },
            );
            image = { url: blob.url, pathname: blob.pathname };
            unsavedUploadRef.current = blob.url;
            // Kept, so trying again after a failed save doesn't upload a second copy.
            setPhoto({ ...photo, uploaded: image });
          } catch {
            setErrors({ image: UPLOAD_FAILED });
            document.getElementById(photoButtonId)?.focus();
            return;
          }
        }
      } else if (photo.kind === "none" && product?.imageUrl) {
        image = null;
      }

      const result = await saveAction({
        id: product?.id,
        ...fields,
        image,
      });
      if (result.ok) {
        unsavedUploadRef.current = null;
        onSaved(result.message);
        return;
      }
      setErrors(result.fieldErrors);
      setFormError(result.formError);
      focusFirstError(result.fieldErrors);
    });
  }

  const adding = product === null;
  const title = adding ? "Add product" : "Edit product";

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title={title}
        actions={
          categories.length > 0 ? (
            <>
              <Button variant="text" disabled={saving} onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit" form={formId} disabled={saving}>
                {adding ? "Add product" : "Save changes"}
              </Button>
            </>
          ) : (
            <Button variant="text" onClick={close}>
              Close
            </Button>
          )
        }
      >
        {categories.length === 0 ? (
          <p className={styles.text}>
            Add a category before adding products.{" "}
            <Link href="/admin/categories" prefetch={false}>
              Go to Categories
            </Link>
          </p>
        ) : (
          <form
            id={formId}
            className={styles.form}
            noValidate
            onSubmit={handleSubmit}
            aria-busy={saving || undefined}
          >
            <TextField
              id={fieldId("name")}
              label="Product name"
              value={fields.name}
              maxLength={80}
              required
              error={errors.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <div className={styles.two}>
              <TextField
                kind="select"
                id={fieldId("categoryId")}
                label="Category"
                value={fields.categoryId}
                error={errors.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </TextField>
              <TextField
                kind="price"
                id={fieldId("price")}
                label="Price"
                value={fields.price}
                placeholder="0"
                required
                error={errors.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </div>
            <div id={fieldId("stockStatus")}>
              <SegmentedButtons
                label="Stock"
                options={STOCK_OPTIONS}
                value={fields.stockStatus}
                onChange={(value) => set("stockStatus", value)}
              />
              {errors.stockStatus && (
                <p className={cx(styles.error, "t-label-small")}>
                  {errors.stockStatus}
                </p>
              )}
            </div>
            <TextField
              id={fieldId("keySpec")}
              label="Key spec"
              value={fields.keySpec}
              maxLength={90}
              placeholder="e.g. Max load 300 kg · 7 back positions"
              hint="One line shown under the name on the product card."
              error={errors.keySpec}
              onChange={(e) => set("keySpec", e.target.value)}
            />
            <TextField
              kind="multiline"
              id={fieldId("description")}
              label="Description"
              value={fields.description}
              maxLength={600}
              rows={3}
              error={errors.description}
              onChange={(e) => set("description", e.target.value)}
            />

            <fieldset className={styles.photoField}>
              <legend className={cx(styles.label, "t-label-small")}>
                Photo
              </legend>
              <div className={styles.photo}>
                <div className={styles.preview}>
                  {photo.kind === "none" ? (
                    <Icon name={category?.icon ?? "category"} size={36} />
                  ) : (
                    <Image
                      src={photo.kind === "new" ? photo.previewUrl : photo.url}
                      alt="Product photo"
                      fill
                      sizes="96px"
                      unoptimized={photo.kind === "new"}
                      className={styles.image}
                    />
                  )}
                </div>
                <div className={styles.photoActions}>
                  <Button
                    id={photoButtonId}
                    variant="outlined"
                    icon="add_photo_alternate"
                    aria-describedby={cx(
                      `${id}-photo-hint`,
                      errors.image && `${id}-photo-error`,
                    )}
                    onClick={() => fileRef.current?.click()}
                  >
                    {photo.kind === "none" ? "Upload photo" : "Replace photo"}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleFile}
                  />
                  {photo.kind !== "none" && (
                    <Button
                      variant="text"
                      onClick={() => {
                        setPhoto({ kind: "none" });
                        setErrors(({ image: _, ...rest }) => rest);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <p
                id={`${id}-photo-hint`}
                className={cx(styles.hint, "t-label-small")}
              >
                Photos are resized to 1600 px on the long side. Without a photo,
                the category icon is shown.
              </p>
              {errors.image && (
                <p
                  id={`${id}-photo-error`}
                  className={cx(styles.error, "t-label-small")}
                >
                  {errors.image}
                </p>
              )}
            </fieldset>

            {formError && (
              <p role="alert" className={cx(styles.error, "t-body-small")}>
                {formError}
              </p>
            )}
          </form>
        )}
      </Dialog>

      <Dialog
        open={open && confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        title="Discard changes to this product?"
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
