import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getStoreSettings } from "@/app/_data/storefront";
import { BRAND_COLORS } from "@/lib/brandColors";
import { BrandMark } from "@/lib/brandMark";

// The share card for the home page (and for products without a photo): the store name
// and headline in the brand colors. Product pages set their photo in `generateMetadata`,
// which takes over from this file for them.

export const alt = "The store's name and headline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  // Per request, so the build needs no database; the settings read is cached.
  await connection();
  const settings = await getStoreSettings();

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 80,
        background: BRAND_COLORS.surface,
        color: BRAND_COLORS.onPrimaryContainer,
        borderBottom: `24px solid ${BRAND_COLORS.primary}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <BrandMark size={112} />
        <div style={{ fontSize: 52, fontWeight: 600 }}>{settings.name}</div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 76,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -1,
          color: BRAND_COLORS.primary,
        }}
      >
        {settings.headline}
      </div>
    </div>,
    size,
  );
}
