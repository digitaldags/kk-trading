import type { FieldErrors } from "@/lib/domain/result";
import type { ProductInput } from "@/lib/domain/schemas";

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
