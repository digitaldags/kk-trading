import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brandMark";

// The favicon: the storefront mark from the app bar. Generated at build time.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BrandMark size={64} />, size);
}
