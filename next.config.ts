import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Product photos and the store logo, uploaded to Vercel Blob under products/ and
    // branding/ (lib/domain/productImages.ts).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/products/**",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/branding/**",
      },
    ],
  },
  experimental: {
    // `unauthorized()`: requireAdmin() answers admin pages and actions without a
    // session with a 401 (lib/auth/requireAdmin.ts).
    authInterrupts: true,
    // The product import sends up to 500 rows of text (ticket 41): about 1 MB at full
    // length, and up to 3 MB in scripts that take more bytes per character. The default
    // is 1 MB. Keep it under Vercel's 4.5 MB request limit.
    serverActions: { bodySizeLimit: "3mb" },
    // serverActions.allowedOrigins is deliberately unset. Next.js rejects a server
    // action whose Origin doesn't match the Host (CSRF). The site is served by Vercel
    // only (its own and custom domains), so they always match. The setting is only for
    // a proxy or CDN in front that changes the host, and setting it widens that trust.
  },
};

export default nextConfig;
