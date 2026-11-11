/**
 * Thrown by the product repository when the unique index on `lower(code)` refuses a
 * write: another save took the code between the service's check and the insert. The
 * service turns it into the same field error as the check.
 */
export class ProductCodeTakenError extends Error {
  /** The refused code, when a batch insert (ticket 41) needs to name it. */
  readonly code?: string;

  constructor(code?: string) {
    super("Another product already uses this code.");
    this.name = "ProductCodeTakenError";
    this.code = code;
  }
}
