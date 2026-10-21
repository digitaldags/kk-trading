/** The storefront URL for a category and search, leaving out empty values: `/?category=gym&q=bench`. */
export function buildCatalogUrl({
  category,
  q,
}: {
  category?: string | null;
  q?: string | null;
}): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const query = q?.trim();
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

/** Link target for a category tile or nav link: filters, then scrolls to the catalog. */
export function categoryHref(slug: string): string {
  return `${buildCatalogUrl({ category: slug })}#catalog`;
}

export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
