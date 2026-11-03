ALTER TABLE "store_settings" ADD COLUMN "logo_width" integer;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "logo_height" integer;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_logo_size_check" CHECK (("store_settings"."logo_width" is null and "store_settings"."logo_height" is null) or ("store_settings"."logo_width" is not null and "store_settings"."logo_height" is not null and "store_settings"."logo_width" > 0 and "store_settings"."logo_height" > 0));--> statement-breakpoint
-- Hand-added: give a published settings row the new keys, as 0002 did. Without them,
-- hasUnpublishedChanges (lib/db/publish.ts) would report the settings as changed right
-- after this ships. A snapshot made before the seed has no settings row.
UPDATE "published_snapshot" ps
SET "data" = jsonb_set(
  ps.data,
  '{settings}',
  (ps.data->'settings') || '{"logo_width": null, "logo_height": null}'::jsonb
)
WHERE ps.id = 1 AND jsonb_typeof(ps.data->'settings') = 'object';
