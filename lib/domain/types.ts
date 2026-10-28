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
