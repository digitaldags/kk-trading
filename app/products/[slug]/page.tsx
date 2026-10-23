import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductDetail } from "@/app/_data/productDetail";
import { getCurrentYear } from "@/app/_data/storefront";
import { AppBar } from "@/components/store/AppBar";
import { Footer } from "@/components/store/Footer";
import { ProductDetail } from "@/components/store/ProductDetail";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/Button";
import { productDescription, productJsonLd } from "@/lib/seo/jsonLd";
import { absoluteUrl, HOME_IMAGE_PATH } from "@/lib/site";
import styles from "./page.module.css";

// Like the storefront: block until the page is complete and send one HTML document, so a
// shared link works without JavaScript and an unknown slug gets a real 404 status.
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getProductDetail(slug);
  if (!detail) return {};
  const { product, settings } = detail;
  const title = `${product.name} · ${settings.name}`;
  const description = productDescription(product);
  const path = `/products/${product.slug}`;
  // The product photo when there is one, else the home page's share card.
  const images = product.imageUrl
    ? [{ url: product.imageUrl, alt: product.name }]
    : [{ url: HOME_IMAGE_PATH, width: 1200, height: 630, alt: settings.name }];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: settings.name,
      title,
      description,
      images,
    },
    twitter: {
      card: product.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

/** A product's own page, for direct visits, shared links and crawlers. */
export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const [detail, year] = await Promise.all([
    getProductDetail(slug),
    getCurrentYear(),
  ]);
  if (!detail) notFound();

  const { product, toneIndex, categories, settings } = detail;

  return (
    <>
      <JsonLd
        data={productJsonLd(product, {
          url: absoluteUrl(`/products/${product.slug}`),
          storeName: settings.name,
        })}
      />
      <AppBar
        storeName={settings.name}
        categories={categories}
        onStorefront={false}
      />
      <main className={styles.main}>
        <div className={styles.content}>
          <Button
            variant="text"
            icon="arrow_back"
            href="/#catalog"
            className={styles.back}
          >
            Back to all products
          </Button>
          <div className={styles.panel}>
            <ProductDetail
              product={product}
              toneIndex={toneIndex}
              settings={settings}
              headingLevel="h1"
            />
          </div>
        </div>
      </main>
      <Footer storeName={settings.name} year={year} />
    </>
  );
}
