/**
 * The site's public origin, for canonical URLs, Open Graph images, the sitemap and
 * JSON-LD (ticket 13). `NEXT_PUBLIC_SITE_URL` when set (it's inlined at build time), else
 * Vercel's production domain, else the local dev server. Never has a trailing slash.
 */
export function siteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

/** An absolute URL on this site: `absoluteUrl("/products/x")`. */
export function absoluteUrl(path: string, base = siteUrl()): string {
  return new URL(path, `${base}/`).toString();
}

/**
 * The home page's generated share image (app/opengraph-image.tsx), also used for products
 * without a photo and in the Store JSON-LD.
 */
export const HOME_IMAGE_PATH = "/opengraph-image";
