import { Storefront } from "@/components/store/Storefront";
import { storefrontFilterSchema } from "@/lib/domain/schemas";
import {
  getCategories,
  getCurrentYear,
  getProducts,
  getStoreSettings,
} from "./_data/storefront";

// Block until the page is complete and send it as one HTML document, with no streamed
// fallback. Filtering is server-side, so the storefront then works without JavaScript.
// The reads below are cached, so the wait is short.
export const instant = false;

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // Reading searchParams makes the page render per request; the data reads are cached.
  const params = await searchParams;
  const { categorySlug, q } = storefrontFilterSchema.parse({
    categorySlug: params.category,
    q: params.q,
  });
  const filter = { categorySlug: categorySlug || undefined, q: q || undefined };

  const [settings, categories, products, year] = await Promise.all([
    getStoreSettings(),
    getCategories(),
    getProducts(filter),
    getCurrentYear(),
  ]);

  return (
    <Storefront
      settings={settings}
      categories={categories}
      products={products}
      filter={filter}
      year={year}
    />
  );
}
