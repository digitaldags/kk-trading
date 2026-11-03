import { z } from "zod";
import { CATEGORY_ICONS } from "./icons";
import { MAX_LOGO_SIDE } from "./logo";
import { parsePriceToCentavos } from "./price";
import { STOCK_STATUSES } from "./stock";
import { UOMS } from "./uom";

// Error copy follows the prototype (docs/reference/prototype.html).
const PRICE_ERROR = "Enter a price of 0 or more, numbers only.";

/** A product that was deleted (or never existed) by the time someone acted on it. */
export const PRODUCT_NOT_FOUND = "That product no longer exists.";

/** The same for a category. */
export const CATEGORY_NOT_FOUND = "That category no longer exists.";

const maxLength = (max: number) => `Use ${max} characters or fewer.`;

const text = (max: number) => z.string().trim().max(max, maxLength(max));

const requiredText = (max: number, missing: string) =>
  z.string(missing).trim().min(1, missing).max(max, maxLength(max));

export const PRODUCT_CODE_TAKEN = "Another product already uses this code.";

/** A Blob file the editor uploaded: leave out to keep the current one, `null` to remove it. */
const blobFile = z
  .object({ url: z.url(), pathname: z.string().min(1) })
  .nullable()
  .optional();

/** A whole number of pixels, as the browser reads an image's size. */
const imageSide = z.number().int().min(1).max(MAX_LOGO_SIDE);

/**
 * The store logo: a Blob file plus its size, read in the browser at upload (ticket 40),
 * so the storefront app bar can reserve its box before the image loads.
 */
const logoFile = z
  .object({
    url: z.url(),
    pathname: z.string().min(1),
    width: imageSide,
    height: imageSide,
  })
  .nullable()
  .optional();

/** A price typed in pesos ("8950", "₱8,950.50"), parsed into centavos. */
const priceField = z
  .union([z.string(), z.number()], PRICE_ERROR)
  .transform((value, ctx) => {
    const centavos = parsePriceToCentavos(value);
    if (centavos === null) {
      ctx.addIssue({ code: "custom", message: PRICE_ERROR });
      return z.NEVER;
    }
    return centavos;
  });

export const productInputSchema = z.object({
  name: requiredText(80, "Enter a product name."),
  // Optional. Whitespace collapsed, so "KK  CHAIR" and "KK CHAIR" count as the same code.
  code: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().max(40, maxLength(40)))
    .default(""),
  uom: z.enum(UOMS, "Choose a unit of measure."),
  // One spec per line: each line trimmed, blank lines dropped.
  specs: z
    .string()
    .transform((s) =>
      s
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n"),
    )
    .pipe(z.string().max(1000, maxLength(1000)))
    .default(""),
  categoryId: z.uuid("Choose a category."),
  price: priceField,
  stockStatus: z.enum(STOCK_STATUSES, "Choose a stock status."),
  keySpec: text(90).default(""),
  description: text(600).default(""),
  /** Leave out to keep the current photo, `null` to remove it. */
  image: blobFile,
});

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductValues = z.output<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  name: requiredText(40, "Enter a category name."),
  blurb: text(70).default(""),
  icon: z.enum(CATEGORY_ICONS, "Choose an icon."),
});

export type CategoryInput = z.input<typeof categoryInputSchema>;
export type CategoryValues = z.output<typeof categoryInputSchema>;

export const storeSettingsInputSchema = z.object({
  name: requiredText(60, "Enter the store name."),
  slogan: text(60).default(""),
  headline: requiredText(120, "Enter a headline."),
  tagline: text(240).default(""),
  // Free text: people write numbers in many formats.
  phone: text(40).default(""),
  phone2: text(40).default(""),
  email: z
    .string("Enter an email address like name@example.com.")
    .trim()
    .pipe(z.email("Enter an email address like name@example.com.")),
  address: text(200).default(""),
  /** Leave out to keep the current logo, `null` to remove it. */
  logo: logoFile,
});

export type StoreSettingsInput = z.input<typeof storeSettingsInputSchema>;
export type StoreSettingsValues = z.output<typeof storeSettingsInputSchema>;

/**
 * Admin sign-in. The email is only matched against stored accounts, so it isn't checked
 * for format (an account can be named "admin").
 */
export const signInSchema = z.object({
  email: requiredText(254, "Enter your email."),
  password: z
    .string("Enter your password.")
    .min(1, "Enter your password.")
    .max(1024, maxLength(1024)),
});

export type SignInInput = z.input<typeof signInSchema>;

/** The shortest admin password, for the password panel, `pnpm db:admin` and the seed. */
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

const MAX_PASSWORD_LENGTH = 1024;

/** The admin's own password change (Store details › Admin password). */
export const passwordChangeSchema = z
  .object({
    currentPassword: z
      .string("Enter your current password.")
      .min(1, "Enter your current password.")
      .max(MAX_PASSWORD_LENGTH, maxLength(MAX_PASSWORD_LENGTH)),
    newPassword: z
      .string(`Use at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`)
      .min(
        MIN_ADMIN_PASSWORD_LENGTH,
        `Use at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
      )
      .max(MAX_PASSWORD_LENGTH, maxLength(MAX_PASSWORD_LENGTH)),
    confirmPassword: z.string("The two passwords don't match."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords don't match.",
  });

export type PasswordChangeInput = z.input<typeof passwordChangeSchema>;

// Quotations and delivery receipts (ticket 19).

export const QUOTATION_NOT_FOUND = "That quotation no longer exists.";
export const QUOTATION_NUMBER_TAKEN =
  "Another quotation already uses this number.";
export const RECEIPT_NOT_FOUND = "That delivery receipt no longer exists.";
export const RECEIPT_NUMBER_TAKEN =
  "Another delivery receipt already uses this number.";

/** A calendar day, "YYYY-MM-DD", that exists (so not "2026-02-30"). */
const isoDate = (message: string) =>
  z
    .string(message)
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, message);

/** A whole number typed in a form (a string) or sent as a number. */
const wholeNumber = (min: number, max: number, message: string) =>
  z.coerce.number(message).int(message).min(min, message).max(max, message);

export const MAX_QUOTATION_QUANTITY = 100_000;

const QUANTITY_ERROR = "Enter a whole number of 1 or more.";

export const quotationInputSchema = z.object({
  number: requiredText(60, "Enter the quotation number."),
  quoteDate: isoDate("Enter a date."),
  customerName: requiredText(120, "Enter the customer's name."),
  customerAddress: text(300).default(""),
  customerTin: text(40).default(""),
  deliveryAddress: text(300).default(""),
  deliveryTerm: text(120).default(""),
  paymentTerms: text(120).default(""),
  remarks: text(120).default(""),
  leadTime: text(120).default(""),
  notes: text(1000).default(""),
  acknowledgement: text(1000).default(""),
  // Drafts may have none; completing needs at least one (quotationService).
  items: z
    .array(
      z.object({
        productId: z.uuid("Choose a product."),
        quantity: wholeNumber(1, MAX_QUOTATION_QUANTITY, QUANTITY_ERROR),
        unitPrice: priceField,
      }),
    )
    .default([])
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item.productId)) {
          ctx.addIssue({
            code: "custom",
            path: [index],
            message: "This product is already on the quotation.",
          });
        }
        seen.add(item.productId);
      });
    }),
});

export type QuotationInput = z.input<typeof quotationInputSchema>;
export type QuotationValues = z.output<typeof quotationInputSchema>;

export const NO_RECEIPT_LINES = "Enter a quantity for at least one item.";

export const deliveryReceiptInputSchema = z.object({
  number: requiredText(60, "Enter the receipt number."),
  receiptDate: isoDate("Enter a date."),
  deliveryAddress: text(300).default(""),
  // Lines set to 0 are left off the receipt.
  lines: z
    .array(
      z.object({
        quotationItemId: z.uuid(NO_RECEIPT_LINES),
        quantity: wholeNumber(
          0,
          MAX_QUOTATION_QUANTITY,
          "Enter a whole number of 0 or more.",
        ),
      }),
      NO_RECEIPT_LINES,
    )
    .superRefine((lines, ctx) => {
      const seen = new Set<string>();
      lines.forEach((line, index) => {
        if (seen.has(line.quotationItemId)) {
          ctx.addIssue({
            code: "custom",
            path: [index],
            message: "This item is already on the receipt.",
          });
        }
        seen.add(line.quotationItemId);
      });
    })
    .transform((lines, ctx) => {
      const delivered = lines.filter((line) => line.quantity > 0);
      if (!delivered.length) {
        ctx.addIssue({ code: "custom", message: NO_RECEIPT_LINES });
        return z.NEVER;
      }
      return delivered;
    }),
});

export type DeliveryReceiptInput = z.input<typeof deliveryReceiptInputSchema>;
export type DeliveryReceiptValues = z.output<typeof deliveryReceiptInputSchema>;

/** Sign-in rate limit: failures counted over this window, per email and per IP. */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 20;

/** Record ids. Anything else (a tampered form, an old link) is treated as not found. */
export const idSchema = z.uuid();

export const isId = (value: unknown): value is string =>
  idSchema.safeParse(value).success;

/** Slugs as `slugify` makes them, with `uniqueSlug`'s `-2` suffixes: "rubber-hex-dumbbells-pair". */
export const slugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Slugs come from the URL, so anything else is treated as not found. */
export const isSlug = (value: unknown): value is string =>
  slugSchema.safeParse(value).success;

export const MAX_SEARCH_LENGTH = 100;

/** Storefront filters come from the URL, so malformed values are dropped, not rejected. */
export const storefrontFilterSchema = z.object({
  categorySlug: z.string().trim().optional().catch(undefined),
  q: z
    .string()
    .trim()
    .transform((q) => q.slice(0, MAX_SEARCH_LENGTH))
    .optional()
    .catch(undefined),
});

export type StorefrontFilter = z.input<typeof storefrontFilterSchema>;
