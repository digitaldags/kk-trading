import type { DeliveryState, QuotationStatus } from "./documents";
import type { StockStatus } from "./stock";
import type { Uom } from "./uom";

export type Category = {
  id: string;
  slug: string;
  name: string;
  /** Material Symbols ligature, one of `CATEGORY_ICONS`. */
  icon: string;
  blurb: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryWithCount = Category & { productCount: number };

export type Product = {
  id: string;
  slug: string;
  categoryId: string;
  name: string;
  /** Printed on quotations and receipts. Optional (empty); unique ignoring case when set. */
  code: string;
  uom: Uom;
  /** One spec per line, printed under the code on documents. */
  specs: string;
  priceCentavos: number;
  stockStatus: StockStatus;
  keySpec: string;
  description: string;
  imageUrl: string | null;
  imagePathname: string | null;
  isSample: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductCategory = Pick<
  Category,
  "id" | "slug" | "name" | "icon" | "sortOrder"
>;

export type ProductWithCategory = Product & { category: ProductCategory };

export type StoreSettings = {
  name: string;
  /** Printed on documents' letterhead, under the name. */
  slogan: string;
  /** The logo in Blob under `branding/`, or null. */
  logoUrl: string | null;
  logoPathname: string | null;
  headline: string;
  tagline: string;
  phone: string;
  phone2: string;
  email: string;
  address: string;
  updatedAt: Date;
};

export type AdminUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  passwordChangedAt: Date;
};

/** The signed-in admin, as pages and actions see it. Never carries the password hash. */
export type AdminSession = Pick<AdminUser, "id" | "email">;

// Quotations and delivery receipts (ticket 18). Dates are "YYYY-MM-DD": a document's
// date is a calendar day, not an instant, so it never shifts with the time zone.

export type Quotation = {
  id: string;
  /** Typed by the admin. Unique, ignoring case. */
  number: string;
  status: QuotationStatus;
  quoteDate: string;
  customerName: string;
  customerAddress: string;
  customerTin: string;
  deliveryAddress: string;
  deliveryTerm: string;
  paymentTerms: string;
  /** The one-line remark, e.g. "PRICES ARE VAT-EXCLUSIVE". */
  remarks: string;
  leadTime: string;
  /** The REMARKS block. */
  notes: string;
  acknowledgement: string;
  completedAt: Date | null;
  declinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A quotation line: its own copy of what it prints, taken from the product when added. */
export type QuotationItem = {
  id: string;
  quotationId: string;
  position: number;
  /** The product it came from. Not a foreign key: the product may be gone or restored. */
  productId: string;
  code: string;
  name: string;
  specs: string;
  uom: Uom;
  imageUrl: string | null;
  unitPriceCentavos: number;
  quantity: number;
};

export type QuotationWithItems = Quotation & { items: QuotationItem[] };

/** A row of the documents list. */
export type QuotationSummary = Pick<
  Quotation,
  "id" | "number" | "status" | "quoteDate" | "customerName" | "updatedAt"
> & {
  itemCount: number;
  grandTotalCentavos: number;
  deliveryState: DeliveryState;
};

export type DeliveryReceipt = {
  id: string;
  quotationId: string;
  /** Typed by the admin. Unique among receipts, ignoring case; may equal a quotation's. */
  number: string;
  receiptDate: string;
  deliveryAddress: string;
  createdAt: Date;
};

export type DeliveryReceiptItem = {
  id: string;
  quotationItemId: string;
  quantity: number;
  /** The quotation line it delivers, which it prints. */
  line: QuotationItem;
};

export type DeliveryReceiptWithItems = DeliveryReceipt & {
  items: DeliveryReceiptItem[];
};
