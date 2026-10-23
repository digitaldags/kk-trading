import { ImageResponse } from "next/og";
import { BRAND_COLORS } from "@/lib/brandColors";
import { BrandMark } from "@/lib/brandMark";

// The home-screen icon on iPhone and iPad. iOS rounds the corners itself, so the mark
// sits on a full square of the same color.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: BRAND_COLORS.primaryContainer,
      }}
    >
      <BrandMark size={180} />
    </div>,
    size,
  );
}
