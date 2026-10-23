import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Product photos, uploaded to Vercel Blob under products/ (lib/domain/productImages.ts).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/products/**",
      },
    ],
  },
  experimental: {
    // `unauthorized()`: requireAdmin() answers admin pages and actions without a
    // session with a 401 (lib/auth/requireAdmin.ts).
    authInterrupts: true,
    // serverActions.allowedOrigins is deliberately unset. Next.js rejects a server
    // action whose Origin doesn't match the Host (CSRF). The site is served by Vercel
    // only (its own and custom domains), so they always match. The setting is only for
    // a proxy or CDN in front that changes the host, and setting it widens that trust.
  },
};

export default nextConfig;
