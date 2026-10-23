import type { Metadata } from "next";
import {
  getCategories,
  getCurrentYear,
  getProducts,
  getStoreSettings,
} from "@/app/_data/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { Storefront } from "@/components/store/Storefront";
import { storefrontFilterSchema } from "@/lib/domain/schemas";
import { storeJsonLd } from "@/lib/seo/jsonLd";
import { absoluteUrl, HOME_IMAGE_PATH } from "@/lib/site";

// Block until the page is complete and send it as one HTML document, with no streamed
// fallback. Filtering is server-side, so the storefront then works without JavaScript.
// The reads below are cached, so the wait is short.
export const instant = false;

export async function generateMetadata({
  searchParams,
}: PageProps<"/">): Promise<Metadata> {
  // Request data first, so `pnpm build` doesn't prerender the settings read.
  await searchParams;
  const settings = await getStoreSettings();
  const description = settings.tagline || settings.headline;
  return {
    title: { absolute: settings.name },
    description,
    // Filtered and searched views are the same page for search engines.
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName: settings.name,
      title: settings.name,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: settings.name,
      description,
    },
  };
}

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
    <>
      <JsonLd
        data={storeJsonLd(settings, {
          url: absoluteUrl("/"),
          image: absoluteUrl(HOME_IMAGE_PATH),
        })}
      />
      <Storefront
        settings={settings}
        categories={categories}
        products={products}
        filter={filter}
        year={year}
      />
    </>
  );
}
