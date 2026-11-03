CREATE TABLE "delivery_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"quotation_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "delivery_receipt_items_quantity_check" CHECK ("delivery_receipt_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"number" text NOT NULL,
	"receipt_date" date NOT NULL,
	"delivery_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"specs" text NOT NULL,
	"uom" text NOT NULL,
	"image_url" text,
	"unit_price_centavos" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "quotation_items_unit_price_centavos_check" CHECK ("quotation_items"."unit_price_centavos" >= 0),
	CONSTRAINT "quotation_items_quantity_check" CHECK ("quotation_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"status" text NOT NULL,
	"quote_date" date NOT NULL,
	"customer_name" text NOT NULL,
	"customer_address" text DEFAULT '' NOT NULL,
	"customer_tin" text DEFAULT '' NOT NULL,
	"delivery_address" text DEFAULT '' NOT NULL,
	"delivery_term" text DEFAULT '' NOT NULL,
	"payment_terms" text DEFAULT '' NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"lead_time" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"acknowledgement" text DEFAULT '' NOT NULL,
	"completed_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_status_check" CHECK ("quotations"."status" in ('draft', 'completed', 'declined'))
);
--> statement-breakpoint
ALTER TABLE "delivery_receipt_items" ADD CONSTRAINT "delivery_receipt_items_receipt_id_delivery_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."delivery_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_receipt_items" ADD CONSTRAINT "delivery_receipt_items_quotation_item_id_quotation_items_id_fk" FOREIGN KEY ("quotation_item_id") REFERENCES "public"."quotation_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_receipt_items_receipt_line_idx" ON "delivery_receipt_items" USING btree ("receipt_id","quotation_item_id");--> statement-breakpoint
CREATE INDEX "delivery_receipt_items_quotation_item_id_idx" ON "delivery_receipt_items" USING btree ("quotation_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_receipts_number_lower_idx" ON "delivery_receipts" USING btree (lower("number"));--> statement-breakpoint
CREATE INDEX "delivery_receipts_quotation_id_idx" ON "delivery_receipts" USING btree ("quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotation_items_quotation_product_idx" ON "quotation_items" USING btree ("quotation_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_number_lower_idx" ON "quotations" USING btree (lower("number"));--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotations_quote_date_idx" ON "quotations" USING btree ("quote_date");--> statement-breakpoint
-- Hand-added: the delivery rules live in Postgres. The app uses Neon's HTTP driver, which
-- has no interactive transactions (atomic() sends one batch), so a service can't read
-- what's left to deliver and write in the same transaction. A raised error rolls back the
-- whole batch, so a refused receipt leaves nothing behind. The repository maps the
-- messages (deliveryReceiptRepo.ts); keep them in sync.
--
-- A receipt line may not take a quotation line past its ordered quantity, across every
-- receipt. Locking the quotation line first serializes two receipts racing for it. It also
-- refuses a line from another quotation than the receipt's.
CREATE FUNCTION "delivery_receipt_items_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ordered integer;
  line_quotation uuid;
  receipt_quotation uuid;
  delivered bigint;
BEGIN
  SELECT quantity, quotation_id INTO ordered, line_quotation
  FROM quotation_items WHERE id = NEW.quotation_item_id
  FOR UPDATE;
  -- An unknown line is left to the foreign key, which reports it.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT quotation_id INTO receipt_quotation
  FROM delivery_receipts WHERE id = NEW.receipt_id;
  IF FOUND AND receipt_quotation <> line_quotation THEN
    RAISE EXCEPTION 'line_not_on_quotation' USING ERRCODE = 'check_violation';
  END IF;

  SELECT coalesce(sum(quantity), 0) INTO delivered
  FROM delivery_receipt_items
  WHERE quotation_item_id = NEW.quotation_item_id AND id <> NEW.id;
  IF delivered + NEW.quantity > ordered THEN
    RAISE EXCEPTION 'over_delivery' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "delivery_receipt_items_guard"
BEFORE INSERT OR UPDATE ON "delivery_receipt_items"
FOR EACH ROW EXECUTE FUNCTION "delivery_receipt_items_guard"();--> statement-breakpoint
-- A receipt only for a completed quotation. The quotation row is locked (shared) so its
-- status can't change while the receipt is written.
CREATE FUNCTION "delivery_receipts_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  quotation_status text;
BEGIN
  SELECT status INTO quotation_status
  FROM quotations WHERE id = NEW.quotation_id
  FOR SHARE;
  -- An unknown quotation is left to the foreign key, which reports it.
  IF FOUND AND quotation_status <> 'completed' THEN
    RAISE EXCEPTION 'quotation_not_completed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "delivery_receipts_guard"
BEFORE INSERT ON "delivery_receipts"
FOR EACH ROW EXECUTE FUNCTION "delivery_receipts_guard"();
