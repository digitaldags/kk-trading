import { formatPeso } from "@/lib/format";
import type { StockStatus } from "@/lib/domain/stock";
import type { ProductWithCategory, StoreSettings } from "@/lib/domain/types";

// Structured data for search results (ticket 13): schema.org `Product` on product pages,
// `Store` on the home page. Pure builders; components/seo/JsonLd.tsx renders them.

const AVAILABILITY: Record<StockStatus, string> = {
  in_stock: "https://schema.org/InStock",
  low_stock: "https://schema.org/LimitedAvailability",
  out_of_stock: "https://schema.org/OutOfStock",
};

/** "8950.00": schema.org wants a plain decimal, no currency sign or grouping. */
export const schemaPrice = (centavos: number) => (centavos / 100).toFixed(2);

/** The description search results and share cards show: key spec and price. */
export function productDescription(
  product: Pick<ProductWithCategory, "keySpec" | "priceCentavos">,
): string {
  const price = formatPeso(product.priceCentavos);
  return product.keySpec ? `${product.keySpec} · ${price}` : price;
}

export function productJsonLd(
  product: ProductWithCategory,
  { url, storeName }: { url: string; storeName: string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || productDescription(product),
    sku: product.slug,
    category: product.category.name,
    ...(product.imageUrl ? { image: [product.imageUrl] } : {}),
    url,
    offers: {
      "@type": "Offer",
      url,
      price: schemaPrice(product.priceCentavos),
      priceCurrency: "PHP",
      availability: AVAILABILITY[product.stockStatus],
      seller: { "@type": "Organization", name: storeName },
    },
  };
}

export function storeJsonLd(
  settings: StoreSettings,
  { url, image }: { url: string; image: string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: settings.name,
    description: settings.tagline || settings.headline,
    url,
    image,
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    ...(settings.address ? { address: settings.address } : {}),
    currenciesAccepted: "PHP",
  };
}

/**
 * JSON for a `<script type="application/ld+json">`. `<` is escaped so text from admin
 * (a product name with "</script>") can't end the script early.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
