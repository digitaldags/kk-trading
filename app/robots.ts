import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/** `/robots.txt`: the store is open to crawlers; admin and the API aren't. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
