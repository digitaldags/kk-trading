import type {
  AdminUser,
  Category,
  CategoryWithCount,
  Product,
  ProductWithCategory,
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
}

export type NewProduct = Pick<
  Product,
  | "slug"
  | "categoryId"
  | "name"
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
  slugsStartingWith(prefix: string): Promise<string[]>;
  /** -1 when there are no products. */
  maxSortOrder(): Promise<number>;
  insert(values: NewProduct): Promise<Product>;
  update(id: string, patch: ProductPatch): Promise<Product | null>;
  /** Returns the deleted product, or null if it didn't exist. */
  delete(id: string): Promise<Product | null>;
}

export type SettingsValues = Omit<StoreSettings, "updatedAt">;

export interface SettingsRepo {
  get(): Promise<StoreSettings | null>;
  /** Writes the single settings row, creating it if needed. */
  update(values: SettingsValues): Promise<StoreSettings>;
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
