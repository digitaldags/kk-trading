-- Hand-edited: products.code is added nullable, backfilled from the slug, then made
-- NOT NULL. upper(slug) is unique ignoring case because slugs are unique and lowercase.
ALTER TABLE "products" ADD COLUMN "code" text;--> statement-breakpoint
UPDATE "products" SET "code" = upper("slug");--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "uom" text DEFAULT 'pcs' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "specs" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "slogan" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "logo_pathname" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "phone2" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_code_lower_idx" ON "products" USING btree (lower("code"));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_uom_check" CHECK ("products"."uom" in ('pcs', 'set', 'pair', 'unit', 'lot'));--> statement-breakpoint
-- Hand-added: give the published snapshot the new keys, with the same values the
-- columns got above. Without them, Discard (restoreFromSnapshot in lib/db/publish.ts)
-- would re-insert products with a null code, and hasUnpublishedChanges would report
-- every product and the settings as changed right after this ships.
UPDATE "published_snapshot" ps
SET "data" = jsonb_set(
  ps.data,
  '{products}',
  coalesce(
    (SELECT jsonb_agg(
       e || jsonb_build_object('code', upper(e->>'slug'), 'uom', 'pcs', 'specs', '')
       ORDER BY t.ord)
     FROM jsonb_array_elements(ps.data->'products') WITH ORDINALITY AS t(e, ord)),
    '[]'::jsonb
  )
)
WHERE ps.id = 1 AND jsonb_typeof(ps.data->'products') = 'array';--> statement-breakpoint
-- Only a published settings row: a snapshot made before the seed has none.
UPDATE "published_snapshot" ps
SET "data" = jsonb_set(
  ps.data,
  '{settings}',
  (ps.data->'settings')
    || '{"slogan": "", "phone2": "", "logo_url": null, "logo_pathname": null}'::jsonb
)
WHERE ps.id = 1 AND jsonb_typeof(ps.data->'settings') = 'object';
