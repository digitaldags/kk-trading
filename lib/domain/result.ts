import type { z } from "zod";

export type FieldErrors<F extends string = string> = Partial<Record<F, string>>;

/** What every service returns. Bad input is a value, never a thrown error. */
export type ServiceResult<T, F extends string = string> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: FieldErrors<F>; formError?: string };

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function fieldError<F extends string>(
  field: F,
  message: string,
): { ok: false; fieldErrors: FieldErrors<F> } {
  return { ok: false, fieldErrors: { [field]: message } as FieldErrors<F> };
}

export function formError(message: string): {
  ok: false;
  fieldErrors: FieldErrors<never>;
  formError: string;
} {
  return { ok: false, fieldErrors: {}, formError: message };
}

/**
 * The first message for each top-level field. With `lineKey`, an issue inside a list
 * (`items[2].quantity`) goes on the key it returns for that row (`"items.2"`), so the
 * form can show it under the row; `undefined` keeps it on the field.
 */
export function fromZodError<F extends string>(
  error: z.ZodError,
  options: {
    lineKey?: (field: string, index: number) => F | undefined;
  } = {},
): { ok: false; fieldErrors: FieldErrors<F> } {
  const fieldErrors: FieldErrors<F> = {};
  for (const issue of error.issues) {
    const [field, index] = issue.path;
    if (typeof field !== "string") continue;
    const key =
      (typeof index === "number" && options.lineKey?.(field, index)) ||
      (field as F);
    if (key in fieldErrors) continue;
    fieldErrors[key] = issue.message;
  }
  return { ok: false, fieldErrors };
}
