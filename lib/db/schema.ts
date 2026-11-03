import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { QUOTATION_STATUSES } from "@/lib/domain/documents";
import { STOCK_STATUSES } from "@/lib/domain/stock";
import { UOMS } from "@/lib/domain/uom";

/** `col in ('a', 'b')` for a check constraint built from a domain list. */
const oneOf = (values: readonly string[]) =>
  sql.raw(values.map((v) => `'${v}'`).join(", "));

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    // Material Symbols ligature, e.g. "chair".
    icon: text("icon").notNull(),
    blurb: text("blurb").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("categories_name_lower_idx").on(sql`lower(${t.name})`)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    // Printed on quotations and delivery receipts (ticket 17). Optional: empty when
    // there's none.
    code: text("code").notNull().default(""),
    uom: text("uom", { enum: UOMS }).notNull().default("pcs"),
    // One spec per line.
    specs: text("specs").notNull().default(""),
    priceCentavos: integer("price_centavos").notNull(),
    stockStatus: text("stock_status", { enum: STOCK_STATUSES }).notNull(),
    keySpec: text("key_spec").notNull().default(""),
    description: text("description").notNull().default(""),
    // Vercel Blob URL and pathname (ticket 10).
    imageUrl: text("image_url"),
    imagePathname: text("image_pathname"),
    isSample: boolean("is_sample").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_category_id_idx").on(t.categoryId),
    index("products_sort_order_idx").on(t.sortOrder),
    // Unique ignoring case, among products that have a code.
    uniqueIndex("products_code_lower_idx")
      .on(sql`lower(${t.code})`)
      .where(sql`${t.code} <> ''`),
    check("products_price_centavos_check", sql`${t.priceCentavos} >= 0`),
    check(
      "products_stock_status_check",
      sql`${t.stockStatus} in (${oneOf(STOCK_STATUSES)})`,
    ),
    check("products_uom_check", sql`${t.uom} in (${oneOf(UOMS)})`),
  ],
);

// A single row, id = 1.
export const storeSettings = pgTable(
  "store_settings",
  {
    id: smallint("id").primaryKey(),
    name: text("name").notNull(),
    // The letterhead of quotations and delivery receipts (ticket 17).
    slogan: text("slogan").notNull().default(""),
    // Vercel Blob URL and pathname, under branding/.
    logoUrl: text("logo_url"),
    logoPathname: text("logo_pathname"),
    // The logo's size in pixels, read in the browser at upload (ticket 40), so the
    // storefront app bar reserves its box. Null for no logo, or one saved before 0005.
    logoWidth: integer("logo_width"),
    logoHeight: integer("logo_height"),
    headline: text("headline").notNull(),
    tagline: text("tagline").notNull(),
    phone: text("phone").notNull(),
    phone2: text("phone2").notNull().default(""),
    email: text("email").notNull(),
    address: text("address").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("store_settings_single_row_check", sql`${t.id} = 1`),
    check(
      "store_settings_logo_size_check",
      // Spelled out: a CHECK passes when it evaluates to NULL, so "> 0" alone would
      // let a width through without a height.
      sql`(${t.logoWidth} is null and ${t.logoHeight} is null) or (${t.logoWidth} is not null and ${t.logoHeight} is not null and ${t.logoWidth} > 0 and ${t.logoHeight} > 0)`,
    ),
  ],
);

// What the storefront shows: one JSON copy of categories, products and settings, made by
// Publish (ticket 15). Admin edits the tables above, which act as the draft. A single
// row, id = 1. See lib/db/publish.ts.
export const publishedSnapshot = pgTable(
  "published_snapshot",
  {
    id: smallint("id").primaryKey(),
    data: jsonb("data").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("published_snapshot_single_row_check", sql`${t.id} = 1`)],
);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  // Sessions issued before this time are rejected (ticket 08).
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    succeeded: boolean("succeeded").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("login_attempts_email_created_at_idx").on(t.email, t.createdAt),
    index("login_attempts_ip_created_at_idx").on(t.ip, t.createdAt),
  ],
);

// Quotations and delivery receipts (ticket 18). Admin-only records, outside draft and
// publish: never in published_snapshot. Only lib/repositories/quotationRepo.ts and
// deliveryReceiptRepo.ts use these tables. Triggers in drizzle/0004_documents.sql refuse
// over-delivery and receipts for a quotation that isn't completed.

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    status: text("status", { enum: QUOTATION_STATUSES }).notNull(),
    quoteDate: date("quote_date", { mode: "string" }).notNull(),
    customerName: text("customer_name").notNull(),
    customerAddress: text("customer_address").notNull().default(""),
    // Free text, no format check.
    customerTin: text("customer_tin").notNull().default(""),
    deliveryAddress: text("delivery_address").notNull().default(""),
    deliveryTerm: text("delivery_term").notNull().default(""),
    paymentTerms: text("payment_terms").notNull().default(""),
    // The one-line remark, e.g. "PRICES ARE VAT-EXCLUSIVE".
    remarks: text("remarks").notNull().default(""),
    leadTime: text("lead_time").notNull().default(""),
    // The REMARKS block.
    notes: text("notes").notNull().default(""),
    acknowledgement: text("acknowledgement").notNull().default(""),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("quotations_number_lower_idx").on(sql`lower(${t.number})`),
    index("quotations_status_idx").on(t.status),
    index("quotations_quote_date_idx").on(t.quoteDate),
    check(
      "quotations_status_check",
      sql`${t.status} in (${oneOf(QUOTATION_STATUSES)})`,
    ),
  ],
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    // Order on the page.
    position: integer("position").notNull(),
    // Deliberately not a foreign key. Discard (restoreFromSnapshot in lib/db/publish.ts)
    // deletes every product and re-inserts it from the snapshot: a `restrict` key would
    // make Discard fail, and `set null` would wipe the link on every Discard. The line
    // keeps its own copy of everything it prints, so it doesn't need the product row.
    productId: uuid("product_id").notNull(),
    // Copied from the product when it's added.
    code: text("code").notNull(),
    name: text("name").notNull(),
    specs: text("specs").notNull(),
    uom: text("uom", { enum: UOMS }).notNull(),
    imageUrl: text("image_url"),
    unitPriceCentavos: integer("unit_price_centavos").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    // Each product appears once per quotation.
    uniqueIndex("quotation_items_quotation_product_idx").on(
      t.quotationId,
      t.productId,
    ),
    check(
      "quotation_items_unit_price_centavos_check",
      sql`${t.unitPriceCentavos} >= 0`,
    ),
    check("quotation_items_quantity_check", sql`${t.quantity} > 0`),
  ],
);

export const deliveryReceipts = pgTable(
  "delivery_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "restrict" }),
    // May equal a quotation's number.
    number: text("number").notNull(),
    receiptDate: date("receipt_date", { mode: "string" }).notNull(),
    // Defaults from the quotation, editable.
    deliveryAddress: text("delivery_address").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("delivery_receipts_number_lower_idx").on(
      sql`lower(${t.number})`,
    ),
    index("delivery_receipts_quotation_id_idx").on(t.quotationId),
  ],
);

export const deliveryReceiptItems = pgTable(
  "delivery_receipt_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => deliveryReceipts.id, { onDelete: "cascade" }),
    quotationItemId: uuid("quotation_item_id")
      .notNull()
      .references(() => quotationItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    uniqueIndex("delivery_receipt_items_receipt_line_idx").on(
      t.receiptId,
      t.quotationItemId,
    ),
    // For the over-delivery trigger's sum per line.
    index("delivery_receipt_items_quotation_item_id_idx").on(t.quotationItemId),
    check("delivery_receipt_items_quantity_check", sql`${t.quantity} > 0`),
  ],
);
