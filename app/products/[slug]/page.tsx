import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductDetail } from "@/app/_data/productDetail";
import { getCurrentYear } from "@/app/_data/storefront";
import { AppBar } from "@/components/store/AppBar";
import { Footer } from "@/components/store/Footer";
import { ProductDetail } from "@/components/store/ProductDetail";
import { Button } from "@/components/ui/Button";
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
  return { title: `${detail.product.name} | ${detail.settings.name}` };
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
