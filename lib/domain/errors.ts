/**
 * Thrown by the product repository when the unique index on `lower(code)` refuses a
 * write: another save took the code between the service's check and the insert. The
 * service turns it into the same field error as the check.
 */
export class ProductCodeTakenError extends Error {
  constructor() {
    super("Another product already uses this code.");
    this.name = "ProductCodeTakenError";
  }
}
