import { serializeJsonLd } from "@/lib/seo/jsonLd";

/** Structured data for search engines, from `lib/seo/jsonLd.ts`. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
