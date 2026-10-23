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

/** The categories page URL: `?edit=<id>` or `?new=1` opens the editor. */
export function categoriesUrl({
  edit,
  isNew,
}: { edit?: string | null; isNew?: boolean } = {}): string {
  if (edit) return `/admin/categories?${new URLSearchParams({ edit })}`;
  return isNew ? "/admin/categories?new=1" : "/admin/categories";
}
