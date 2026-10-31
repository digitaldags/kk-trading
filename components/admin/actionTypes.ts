import type { FieldErrors } from "@/lib/domain/result";
import type {
  CategoryInput,
  PasswordChangeInput,
  ProductInput,
  QuotationInput,
  StoreSettingsInput,
} from "@/lib/domain/schemas";
import type { QuotationField } from "@/lib/services/quotationService";

// What the admin server actions (app/admin/(console)/actions.ts) take and return. The
// components get the actions as props, so they render the same in tests.

/** A result the page shows in the snackbar. */
export type ActionMessage = { ok: boolean; message: string };

export type ProductField = keyof ProductInput;

/** The editor's fields. No `id` adds a product. */
export type SaveProductInput = ProductInput & { id?: string };

export type SaveProductResult =
  | { ok: true; message: string }
  | { ok: false; fieldErrors: FieldErrors<ProductField>; formError?: string };

export type DeleteProductAction = (id: string) => Promise<ActionMessage>;
export type SaveProductAction = (
  input: SaveProductInput,
) => Promise<SaveProductResult>;
export type DiscardUploadAction = (url: string) => Promise<void>;

/** A save that can come back with errors for each field, or a message for the snackbar. */
export type SaveResult<F extends string> =
  | { ok: true; message: string }
  | { ok: false; fieldErrors: FieldErrors<F>; formError?: string };

export type CategoryField = keyof CategoryInput;

/** The editor's fields. No `id` adds a category. */
export type SaveCategoryInput = CategoryInput & { id?: string };

export type SaveCategoryAction = (
  input: SaveCategoryInput,
) => Promise<SaveResult<CategoryField>>;
/** `moveProductsTo` is needed when the category still has products. */
export type DeleteCategoryAction = (
  id: string,
  moveProductsTo?: string,
) => Promise<ActionMessage>;
/** No message on success: the list itself shows the new order. */
export type MoveCategoryAction = (
  id: string,
  direction: "up" | "down",
) => Promise<{ ok: true } | ActionMessage>;

export type StoreDetailsField = keyof StoreSettingsInput;
export type SaveStoreDetailsAction = (
  input: StoreSettingsInput,
) => Promise<SaveResult<StoreDetailsField>>;
export type DiscardLogoAction = (url: string) => Promise<void>;

export type PasswordField = keyof PasswordChangeInput;
export type ChangePasswordAction = (
  input: PasswordChangeInput,
) => Promise<SaveResult<PasswordField>>;

/** Publish or Discard (ticket 15). */
export type PublishAction = () => Promise<ActionMessage>;

// Quotations (ticket 21): app/admin/(console)/documents/actions.ts.

/** The editor's fields. No `id` creates a draft. */
export type SaveQuotationInput = QuotationInput & { id?: string };

export type SaveQuotationResult =
  | {
      ok: true;
      message: string;
      id: string;
      number: string;
      /** ISO timestamp, for "Last saved". */
      updatedAt: string;
    }
  | {
      ok: false;
      fieldErrors: FieldErrors<QuotationField>;
      formError?: string;
    };

export type SaveQuotationAction = (
  input: SaveQuotationInput,
) => Promise<SaveQuotationResult>;
/** Mark as completed, Mark as declined or Delete draft. */
export type QuotationAction = (id: string) => Promise<ActionMessage>;
