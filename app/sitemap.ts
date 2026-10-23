import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getProducts } from "@/app/_data/storefront";
import { absoluteUrl } from "@/lib/site";

/** `/sitemap.xml`: the home page and every published product. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Per request, so the build needs no database; the product read is cached.
  await connection();
  const products = await getProducts({});
  const latest = products.reduce<Date | undefined>(
    (max, p) => (!max || p.updatedAt > max ? p.updatedAt : max),
    undefined,
  );
  return [
    { url: absoluteUrl("/"), lastModified: latest, changeFrequency: "weekly" },
    ...products.map((p) => ({
      url: absoluteUrl(`/products/${p.slug}`),
      lastModified: p.updatedAt,
    })),
  ];
}
