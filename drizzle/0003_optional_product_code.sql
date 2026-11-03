-- The product code is optional: new products default to an empty code, and only codes
-- that are filled in must be unique (ignoring case). Codes 0002 backfilled from slugs
-- stay. The snapshot already has the `code` key, so it needs no change.
DROP INDEX "products_code_lower_idx";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "code" SET DEFAULT '';--> statement-breakpoint
CREATE UNIQUE INDEX "products_code_lower_idx" ON "products" USING btree (lower("code")) WHERE "products"."code" <> '';
