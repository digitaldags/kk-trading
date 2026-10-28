import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
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
    headline: text("headline").notNull(),
    tagline: text("tagline").notNull(),
    phone: text("phone").notNull(),
    phone2: text("phone2").notNull().default(""),
    email: text("email").notNull(),
    address: text("address").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [check("store_settings_single_row_check", sql`${t.id} = 1`)],
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
