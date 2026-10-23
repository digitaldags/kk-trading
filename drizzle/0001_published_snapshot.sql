CREATE TABLE "published_snapshot" (
	"id" smallint PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "published_snapshot_single_row_check" CHECK ("published_snapshot"."id" = 1)
);
--> statement-breakpoint
-- Hand-added: publish what the store shows today, so the storefront doesn't change when
-- this ships. Same document as liveStoreJson in lib/db/publish.ts.
INSERT INTO "published_snapshot" ("id", "data", "published_at")
SELECT 1, jsonb_build_object(
  'categories', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id::text) FROM categories c), '[]'::jsonb),
  'products', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id::text) FROM products p), '[]'::jsonb),
  'settings', (SELECT to_jsonb(s) FROM store_settings s WHERE s.id = 1)
), now()
ON CONFLICT ("id") DO NOTHING;
