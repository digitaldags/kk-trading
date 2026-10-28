import { describe, expect, it } from "vitest";
import { isBrandingImageUrl, isProductImageUrl } from "./productImages";

const blob = (path: string) =>
  `https://abc123.public.blob.vercel-storage.com/${path}`;

describe("isProductImageUrl and isBrandingImageUrl", () => {
  it("each accepts only its own folder in a public Blob store", () => {
    expect(isProductImageUrl(blob("products/a.webp"))).toBe(true);
    expect(isProductImageUrl(blob("branding/logo.png"))).toBe(false);
    expect(isBrandingImageUrl(blob("branding/logo.png"))).toBe(true);
    expect(isBrandingImageUrl(blob("products/a.webp"))).toBe(false);
  });

  it("refuses other hosts, plain http and malformed URLs", () => {
    expect(isBrandingImageUrl("https://example.com/branding/logo.png")).toBe(
      false,
    );
    expect(
      isBrandingImageUrl(
        "http://abc123.public.blob.vercel-storage.com/branding/logo.png",
      ),
    ).toBe(false);
    expect(isBrandingImageUrl("branding/logo.png")).toBe(false);
    expect(isBrandingImageUrl(blob("brandings/logo.png"))).toBe(false);
  });
});
