/**
 * A Postgres error's code, constraint, message and detail. Drizzle wraps the driver's
 * error in `cause`.
 */
export function pgError(error: unknown): {
  code?: string;
  constraint?: string;
  message?: string;
  detail?: string;
} | null {
  if (typeof error !== "object" || error === null) return null;
  const cause = (error as { cause?: unknown }).cause;
  const source = (
    typeof cause === "object" && cause !== null && "code" in cause
      ? cause
      : error
  ) as {
    code?: unknown;
    constraint?: unknown;
    message?: unknown;
    detail?: unknown;
  };
  if (typeof source.code !== "string") return null;
  return {
    code: source.code,
    constraint:
      typeof source.constraint === "string" ? source.constraint : undefined,
    message: typeof source.message === "string" ? source.message : undefined,
    detail: typeof source.detail === "string" ? source.detail : undefined,
  };
}

/** Whether `error` is a unique violation (23505) of the named index. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const pg = pgError(error);
  return pg?.code === "23505" && pg.constraint === constraint;
}

/**
 * Whether `error` is a check violation (23514) raised with this message, as the
 * triggers in drizzle/0004_documents.sql do.
 */
export function isRaisedCheck(error: unknown, message: string): boolean {
  const pg = pgError(error);
  return pg?.code === "23514" && pg.message === message;
}
