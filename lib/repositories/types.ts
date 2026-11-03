import type { QuotationStatus } from "@/lib/domain/documents";
import type {
  AdminUser,
  Category,
  CategoryWithCount,
  DeliveryReceipt,
  DeliveryReceiptWithItems,
  Product,
  ProductWithCategory,
  Quotation,
  QuotationItem,
  QuotationSummary,
  QuotationWithItems,
  StoreSettings,
} from "@/lib/domain/types";

export type NewCategory = Pick<
  Category,
  "slug" | "name" | "icon" | "blurb" | "sortOrder"
>;
export type CategoryPatch = Partial<
  Pick<Category, "name" | "icon" | "blurb" | "sortOrder">
>;

export interface CategoryRepo {
  /** All categories in storefront order, with how many products each has. */
  list(): Promise<CategoryWithCount[]>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  /** Case-insensitive. */
  findByName(name: string): Promise<Category | null>;
  slugsStartingWith(prefix: string): Promise<string[]>;
  /** -1 when there are no categories. */
  maxSortOrder(): Promise<number>;
  countProducts(id: string): Promise<number>;
  insert(values: NewCategory): Promise<Category>;
  update(id: string, patch: CategoryPatch): Promise<Category | null>;
  /** Fails if the category still has products (`on delete restrict`). */
  delete(id: string): Promise<boolean>;
  /** Moves every product to `toId`, then deletes the category, in one transaction. */
  moveProductsAndDelete(fromId: string, toId: string): Promise<void>;
  /** Sets each category's `sortOrder` to its index in `ids`, in one transaction. */
  setSortOrders(ids: string[]): Promise<void>;
}

export type NewProduct = Pick<
  Product,
  | "slug"
  | "categoryId"
  | "name"
  | "code"
  | "uom"
  | "specs"
  | "priceCentavos"
  | "stockStatus"
  | "keySpec"
  | "description"
  | "imageUrl"
  | "imagePathname"
  | "isSample"
  | "sortOrder"
>;
export type ProductPatch = Partial<Omit<NewProduct, "slug">>;

export type ProductFilter = { categoryId?: string; q?: string };

export interface ProductRepo {
  /** Ordered by category sort, product sort, then name. `q` matches name, key spec and description, ignoring case. */
  listWithCategory(filter?: ProductFilter): Promise<ProductWithCategory[]>;
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<ProductWithCategory | null>;
  /** Case-insensitive. Pass a filled-in code: many products can have an empty one. */
  findByCode(code: string): Promise<Product | null>;
  slugsStartingWith(prefix: string): Promise<string[]>;
  /** -1 when there are no products. */
  maxSortOrder(): Promise<number>;
  /** Throws `ProductCodeTakenError` when the unique code index refuses it. */
  insert(values: NewProduct): Promise<Product>;
  /** Throws `ProductCodeTakenError` when the unique code index refuses it. */
  update(id: string, patch: ProductPatch): Promise<Product | null>;
  /** Returns the deleted product, or null if it didn't exist. */
  delete(id: string): Promise<Product | null>;
  /**
   * Whether anything still shows this photo: a product in the draft or the published
   * store, or a quotation line (ticket 18).
   */
  isImageInUse(url: string): Promise<boolean>;
}

/** What the storefront shows: the last published copy of the store (ticket 15). */
export type PublishedStore = {
  /** In storefront order, with how many published products each has. */
  categories: CategoryWithCount[];
  /** Ordered like `ProductRepo.listWithCategory`. */
  products: ProductWithCategory[];
  /** Null only if nothing had been seeded when the store was published. */
  settings: StoreSettings | null;
  publishedAt: Date;
};

export interface PublishRepo {
  /** Null until the first publish. */
  getPublished(): Promise<PublishedStore | null>;
  /** Copies the live tables (the draft) into the published snapshot, atomically. */
  publish(): Promise<void>;
  /**
   * Puts the live tables back to the published snapshot, in one transaction. False (and
   * nothing changes) when nothing was ever published.
   */
  discard(): Promise<boolean>;
  /** Whether the draft differs from the snapshot, ignoring timestamps. */
  hasUnpublishedChanges(): Promise<boolean>;
}

export type SettingsValues = Omit<StoreSettings, "updatedAt">;

export interface SettingsRepo {
  get(): Promise<StoreSettings | null>;
  /** Writes the single settings row, creating it if needed. */
  update(values: SettingsValues): Promise<StoreSettings>;
  /** Whether the store shows this logo, in the draft or in the published store. */
  isLogoInUse(url: string): Promise<boolean>;
}

export interface AdminUserRepo {
  /** Case-insensitive. */
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  /** The email is stored lowercased and trimmed. */
  insert(values: Pick<AdminUser, "email" | "passwordHash">): Promise<AdminUser>;
  /** Also sets `passwordChangedAt` to now, which signs out older sessions. */
  updatePassword(id: string, passwordHash: string): Promise<AdminUser | null>;
}

export type LoginAttempt = { email: string; ip: string; succeeded: boolean };

export interface LoginAttemptRepo {
  record(attempt: LoginAttempt): Promise<void>;
  countFailuresByEmail(email: string, since: Date): Promise<number>;
  countFailuresByIp(ip: string, since: Date): Promise<number>;
}

/** A write that can be refused for a known reason, instead of throwing. */
export type RepoResult<T, R extends string> =
  { ok: true; data: T } | { ok: false; reason: R };

/** A quotation's header as the admin writes it. Ids, timestamps and `*At` are the repo's. */
export type NewQuotation = Omit<
  Quotation,
  "id" | "completedAt" | "declinedAt" | "createdAt" | "updatedAt"
>;

/** A quotation line to write. Its position is its index in the list. */
export type NewQuotationItem = Omit<
  QuotationItem,
  "id" | "quotationId" | "position"
>;

export type QuotationFilter = { status?: QuotationStatus; q?: string };

export interface QuotationRepo {
  /**
   * Newest `quoteDate` first, then newest created. `q` matches the number or the
   * customer name, ignoring case. Totals and the delivery state are computed in SQL.
   */
  list(filter?: QuotationFilter): Promise<QuotationSummary[]>;
  /** With its items in page order. */
  findById(id: string): Promise<QuotationWithItems | null>;
  /** Case-insensitive. */
  findByNumber(number: string): Promise<Quotation | null>;
  insert(
    header: NewQuotation,
    items: NewQuotationItem[],
  ): Promise<RepoResult<QuotationWithItems, "duplicate_number">>;
  /**
   * Rewrites the header and all the items, in one transaction. `null` data when the
   * quotation doesn't exist. Fails once a receipt delivers its lines (the foreign key
   * restricts), so only drafts are replaced.
   */
  replace(
    id: string,
    header: NewQuotation,
    items: NewQuotationItem[],
  ): Promise<RepoResult<QuotationWithItems | null, "duplicate_number">>;
  /**
   * Moves the status from `from` to `to`, stamping `completedAt` / `declinedAt`. Null
   * when the quotation is gone or its status was no longer `from`.
   */
  setStatus(
    id: string,
    from: QuotationStatus,
    to: QuotationStatus,
  ): Promise<Quotation | null>;
  /** Its items go by cascade. Fails if it has receipts (restrict). */
  delete(id: string): Promise<boolean>;
}

export type NewDeliveryReceipt = Omit<DeliveryReceipt, "id" | "createdAt">;

export type NewDeliveryReceiptItem = {
  quotationItemId: string;
  quantity: number;
};

export type DeliveryReceiptRefusal =
  "duplicate_number" | "over_delivery" | "not_completed";

export interface DeliveryReceiptRepo {
  /** Oldest first, with their items. */
  listForQuotation(quotationId: string): Promise<DeliveryReceiptWithItems[]>;
  /** Quantity delivered so far per quotation line, by every receipt. Lines with none are left out. */
  deliveredByLine(quotationId: string): Promise<Map<string, number>>;
  /** With its items, each joined to the quotation line it prints. */
  findById(id: string): Promise<DeliveryReceiptWithItems | null>;
  /** Case-insensitive. */
  findByNumber(number: string): Promise<DeliveryReceipt | null>;
  /**
   * Writes the receipt and its items in one transaction. The database refuses
   * over-delivery and a quotation that isn't completed; nothing is written then.
   */
  insert(
    header: NewDeliveryReceipt,
    items: NewDeliveryReceiptItem[],
  ): Promise<RepoResult<DeliveryReceiptWithItems, DeliveryReceiptRefusal>>;
  /** Its items go by cascade, so their quantities count as undelivered again. */
  delete(id: string): Promise<boolean>;
}
