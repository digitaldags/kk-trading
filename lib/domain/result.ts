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

/** The first message for each top-level field. */
export function fromZodError<F extends string>(
  error: z.ZodError,
): { ok: false; fieldErrors: FieldErrors<F> } {
  const fieldErrors: FieldErrors<F> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || field in fieldErrors) continue;
    fieldErrors[field as F] = issue.message;
  }
  return { ok: false, fieldErrors };
}
