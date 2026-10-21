// Product photos live in Vercel Blob under `products/` (app/api/blob/upload/route.ts).
// next.config.ts allows the same host and path for next/image.

/** Pathname prefix for every product photo in the Blob store. */
export const PRODUCT_IMAGE_PREFIX = "products/";

/** Public Vercel Blob stores are served from `<store id>.public.blob.vercel-storage.com`. */
export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export const PRODUCT_IMAGE_TYPES = [
  "image/webp",
  "image/jpeg",
  "image/png",
] as const;

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Whether a URL is a product photo in a public Blob store. Anything else would make
 * next/image refuse to render the storefront, so it's never saved or deleted.
 */
export function isProductImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname.endsWith(BLOB_HOST_SUFFIX) &&
    url.pathname.startsWith(`/${PRODUCT_IMAGE_PREFIX}`)
  );
}
