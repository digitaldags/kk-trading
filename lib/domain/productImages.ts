// Product photos live in Vercel Blob under `products/`, the store logo under `branding/`
// (app/api/blob/upload/route.ts). next.config.ts allows the same host and paths for
// next/image.

/** Pathname prefix for every product photo in the Blob store. */
export const PRODUCT_IMAGE_PREFIX = "products/";

/** Pathname prefix for the store logo (ticket 17). */
export const BRANDING_IMAGE_PREFIX = "branding/";

/** Public Vercel Blob stores are served from `<store id>.public.blob.vercel-storage.com`. */
export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export const PRODUCT_IMAGE_TYPES = [
  "image/webp",
  "image/jpeg",
  "image/png",
] as const;

/**
 * The logo's allowed types: the same as photos. No SVG, which next/image would only
 * serve with `dangerouslyAllowSVG`.
 */
export const BRANDING_IMAGE_TYPES = PRODUCT_IMAGE_TYPES;

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

function isBlobUrlUnder(value: string, prefix: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname.endsWith(BLOB_HOST_SUFFIX) &&
    url.pathname.startsWith(`/${prefix}`)
  );
}

/**
 * Whether a URL is a product photo in a public Blob store. Anything else would make
 * next/image refuse to render the storefront, so it's never saved or deleted.
 */
export function isProductImageUrl(value: string): boolean {
  return isBlobUrlUnder(value, PRODUCT_IMAGE_PREFIX);
}

/** The same for the store logo, under `branding/`. */
export function isBrandingImageUrl(value: string): boolean {
  return isBlobUrlUnder(value, BRANDING_IMAGE_PREFIX);
}
