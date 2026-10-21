import { z } from "zod";
import { CATEGORY_ICONS } from "./icons";
import { parsePriceToCentavos } from "./price";
import { STOCK_STATUSES } from "./stock";

// Error copy follows the prototype (docs/reference/prototype.html).
const PRICE_ERROR = "Enter a price of 0 or more, numbers only.";

const maxLength = (max: number) => `Use ${max} characters or fewer.`;

const text = (max: number) => z.string().trim().max(max, maxLength(max));

const requiredText = (max: number, missing: string) =>
  z.string(missing).trim().min(1, missing).max(max, maxLength(max));

export const productInputSchema = z.object({
  name: requiredText(80, "Enter a product name."),
  categoryId: z.uuid("Choose a category."),
  price: z
    .union([z.string(), z.number()], PRICE_ERROR)
    .transform((value, ctx) => {
      const centavos = parsePriceToCentavos(value);
      if (centavos === null) {
        ctx.addIssue({ code: "custom", message: PRICE_ERROR });
        return z.NEVER;
      }
      return centavos;
    }),
  stockStatus: z.enum(STOCK_STATUSES, "Choose a stock status."),
  keySpec: text(90).default(""),
  description: text(600).default(""),
  /** Leave out to keep the current photo, `null` to remove it. */
  image: z
    .object({ url: z.url(), pathname: z.string().min(1) })
    .nullable()
    .optional(),
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
  headline: requiredText(120, "Enter a headline."),
  tagline: text(240).default(""),
  // Free text: people write numbers in many formats.
  phone: text(40).default(""),
  email: z
    .string("Enter an email address like name@example.com.")
    .trim()
    .pipe(z.email("Enter an email address like name@example.com.")),
  address: text(200).default(""),
});

export type StoreSettingsInput = z.input<typeof storeSettingsInputSchema>;
export type StoreSettingsValues = z.output<typeof storeSettingsInputSchema>;

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
