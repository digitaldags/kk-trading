import type { QuotationStatus } from "@/lib/domain/documents";

/**
 * The products page URL, leaving out empty values: `/admin?q=chair&edit=<id>`.
 * `edit` and `isNew` open the editor; `q` is kept so closing it returns to the search.
 */
export function productsUrl({
  q,
  edit,
  isNew,
}: {
  q?: string | null;
  edit?: string | null;
  isNew?: boolean;
} = {}): string {
  const params = new URLSearchParams();
  const query = q?.trim();
  if (query) params.set("q", query);
  if (edit) params.set("edit", edit);
  else if (isNew) params.set("new", "1");
  const search = params.toString();
  return search ? `/admin?${search}` : "/admin";
}

/** The documents list URL, leaving out empty values: `/admin/documents?q=acme&status=draft`. */
export function documentsUrl({
  q,
  status,
}: { q?: string | null; status?: QuotationStatus | null } = {}): string {
  const params = new URLSearchParams();
  const query = q?.trim();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  const search = params.toString();
  return search ? `/admin/documents?${search}` : "/admin/documents";
}

/** One quotation's page (ticket 21). */
export function quotationUrl(id: string): string {
  return `/admin/documents/${encodeURIComponent(id)}`;
}

/** The categories page URL: `?edit=<id>` or `?new=1` opens the editor. */
export function categoriesUrl({
  edit,
  isNew,
}: { edit?: string | null; isNew?: boolean } = {}): string {
  if (edit) return `/admin/categories?${new URLSearchParams({ edit })}`;
  return isNew ? "/admin/categories?new=1" : "/admin/categories";
}

/** A quotation's print page (ticket 23). */
export function quotationPrintUrl(id: string): string {
  return `/admin/print/quotations/${encodeURIComponent(id)}`;
}

/** A delivery receipt's print page (ticket 23). */
export function receiptPrintUrl(id: string): string {
  return `/admin/print/receipts/${encodeURIComponent(id)}`;
}
