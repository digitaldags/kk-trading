/** A Postgres error's code and constraint. Drizzle wraps the driver's error in `cause`. */
export function pgError(
  error: unknown,
): { code?: string; constraint?: string } | null {
  if (typeof error !== "object" || error === null) return null;
  const cause = (error as { cause?: unknown }).cause;
  const source = (
    typeof cause === "object" && cause !== null && "code" in cause
      ? cause
      : error
  ) as { code?: unknown; constraint?: unknown };
  if (typeof source.code !== "string") return null;
  return {
    code: source.code,
    constraint:
      typeof source.constraint === "string" ? source.constraint : undefined,
  };
}

/** Whether `error` is a unique violation (23505) of the named index. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const pg = pgError(error);
  return pg?.code === "23505" && pg.constraint === constraint;
}
