import type {
  AdminUser,
  Category,
  Product,
  StoreSettings,
} from "@/lib/domain/types";
import type {
  AdminUserRepo,
  CategoryRepo,
  LoginAttempt,
  LoginAttemptRepo,
  ProductRepo,
  SettingsRepo,
} from "@/lib/repositories/types";
import type { ImageStore } from "../imageStore";

// In-memory stand-ins for the repositories, so service rules are tested without a database.
// The SQL itself is tested on PGlite in lib/repositories/repos.test.ts.

let nextId = 0;
const newId = () =>
  `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`;

export function createFakeStore() {
  const categories = new Map<string, Category>();
  const products = new Map<string, Product>();
  let settings: StoreSettings | null = null;
  /** Makes the next repo write throw, to test what happens when a save fails. */
  let failNext: Error | null = null;

  function maybeFail() {
    if (failNext) {
      const error = failNext;
      failNext = null;
      throw error;
    }
  }

  const productsIn = (categoryId: string) =>
    [...products.values()].filter((p) => p.categoryId === categoryId);

  const categoryRepo: CategoryRepo = {
    async list() {
      return [...categories.values()]
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        )
        .map((c) => ({ ...c, productCount: productsIn(c.id).length }));
    },
    async findById(id) {
      return categories.get(id) ?? null;
    },
    async findBySlug(slug) {
      return [...categories.values()].find((c) => c.slug === slug) ?? null;
    },
    async findByName(name) {
      const lower = name.trim().toLowerCase();
      return (
        [...categories.values()].find((c) => c.name.toLowerCase() === lower) ??
        null
      );
    },
    async slugsStartingWith(prefix) {
      return [...categories.values()]
        .map((c) => c.slug)
        .filter((s) => s.startsWith(prefix));
    },
    async maxSortOrder() {
      return Math.max(-1, ...[...categories.values()].map((c) => c.sortOrder));
    },
    async countProducts(id) {
      return productsIn(id).length;
    },
    async insert(values) {
      maybeFail();
      const now = new Date();
      const category = {
        ...values,
        id: newId(),
        createdAt: now,
        updatedAt: now,
      };
      categories.set(category.id, category);
      return category;
    },
    async update(id, patch) {
      maybeFail();
      const existing = categories.get(id);
      if (!existing) return null;
      const category = { ...existing, ...patch, updatedAt: new Date() };
      categories.set(id, category);
      return category;
    },
    async delete(id) {
      maybeFail();
      if (productsIn(id).length) throw new Error("restrict_violation");
      return categories.delete(id);
    },
    async moveProductsAndDelete(fromId, toId) {
      // All or nothing, like the database transaction.
      maybeFail();
      if (!categories.has(toId)) throw new Error("foreign_key_violation");
      for (const p of productsIn(fromId)) {
        products.set(p.id, { ...p, categoryId: toId });
      }
      categories.delete(fromId);
    },
  };

  const productRepo: ProductRepo = {
    async listWithCategory({ categoryId, q } = {}) {
      const needle = q?.toLowerCase();
      return [...products.values()]
        .filter((p) => !categoryId || p.categoryId === categoryId)
        .filter(
          (p) =>
            !needle ||
            [p.name, p.keySpec, p.description].some((t) =>
              t.toLowerCase().includes(needle),
            ),
        )
        .map((p) => {
          const c = categories.get(p.categoryId)!;
          return {
            ...p,
            category: {
              id: c.id,
              slug: c.slug,
              name: c.name,
              icon: c.icon,
              sortOrder: c.sortOrder,
            },
          };
        })
        .sort(
          (a, b) =>
            a.category.sortOrder - b.category.sortOrder ||
            a.sortOrder - b.sortOrder ||
            a.name.localeCompare(b.name),
        );
    },
    async findById(id) {
      return products.get(id) ?? null;
    },
    async findBySlug(slug) {
      const all = await productRepo.listWithCategory();
      return all.find((p) => p.slug === slug) ?? null;
    },
    async slugsStartingWith(prefix) {
      return [...products.values()]
        .map((p) => p.slug)
        .filter((s) => s.startsWith(prefix));
    },
    async maxSortOrder() {
      return Math.max(-1, ...[...products.values()].map((p) => p.sortOrder));
    },
    async insert(values) {
      maybeFail();
      const now = new Date();
      const product = {
        ...values,
        id: newId(),
        createdAt: now,
        updatedAt: now,
      };
      products.set(product.id, product);
      return product;
    },
    async update(id, patch) {
      maybeFail();
      const existing = products.get(id);
      if (!existing) return null;
      const product = { ...existing, ...patch, updatedAt: new Date() };
      products.set(id, product);
      return product;
    },
    async delete(id) {
      maybeFail();
      const existing = products.get(id) ?? null;
      products.delete(id);
      return existing;
    },
    async isImageInUse(url) {
      return [...products.values()].some((p) => p.imageUrl === url);
    },
  };

  const settingsRepo: SettingsRepo = {
    async get() {
      return settings;
    },
    async update(values) {
      maybeFail();
      settings = { ...values, updatedAt: new Date() };
      return settings;
    },
  };

  /** The fake clock for admins and login attempts. Move it with `clock.set()`. */
  let now = new Date("2026-10-21T08:00:00Z");
  const clock = {
    now: () => new Date(now),
    set(date: Date) {
      now = new Date(date);
    },
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };

  const admins = new Map<string, AdminUser>();
  const adminUserRepo: AdminUserRepo = {
    async findByEmail(email) {
      const wanted = email.trim().toLowerCase();
      return [...admins.values()].find((a) => a.email === wanted) ?? null;
    },
    async findById(id) {
      return admins.get(id) ?? null;
    },
    async insert({ email, passwordHash }) {
      const admin: AdminUser = {
        id: newId(),
        email: email.trim().toLowerCase(),
        passwordHash,
        createdAt: clock.now(),
        passwordChangedAt: clock.now(),
      };
      admins.set(admin.id, admin);
      return admin;
    },
    async updatePassword(id, passwordHash) {
      const admin = admins.get(id);
      if (!admin) return null;
      const updated = {
        ...admin,
        passwordHash,
        passwordChangedAt: clock.now(),
      };
      admins.set(id, updated);
      return updated;
    },
  };

  const loginAttempts: (LoginAttempt & { createdAt: Date })[] = [];
  const countFailures = (match: (a: LoginAttempt) => boolean, since: Date) =>
    loginAttempts.filter(
      (a) => !a.succeeded && a.createdAt >= since && match(a),
    ).length;
  const loginAttemptRepo: LoginAttemptRepo = {
    async record({ email, ip, succeeded }) {
      loginAttempts.push({
        email: email.trim().toLowerCase(),
        ip,
        succeeded,
        createdAt: clock.now(),
      });
    },
    async countFailuresByEmail(email, since) {
      const wanted = email.trim().toLowerCase();
      return countFailures((a) => a.email === wanted, since);
    },
    async countFailuresByIp(ip, since) {
      return countFailures((a) => a.ip === ip, since);
    },
  };

  /** Records which images were deleted. */
  const imageStore: ImageStore & { deleted: string[] } = {
    deleted: [],
    async delete(url) {
      imageStore.deleted.push(url);
    },
  };

  return {
    categoryRepo,
    productRepo,
    settingsRepo,
    adminUserRepo,
    loginAttemptRepo,
    loginAttempts,
    clock,
    imageStore,
    failNextWrite(error = new Error("Simulated database failure")) {
      failNext = error;
    },
    /** Adds a category directly, skipping the service. */
    async addCategory(values: Partial<Category> & Pick<Category, "name">) {
      return categoryRepo.insert({
        slug: values.slug ?? values.name.toLowerCase().replace(/\W+/g, "-"),
        icon: "category",
        blurb: "",
        sortOrder: (await categoryRepo.maxSortOrder()) + 1,
        ...values,
      });
    },
    /** Adds a product directly, skipping the service. */
    async addProduct(
      values: Partial<Product> & Pick<Product, "name" | "categoryId">,
    ) {
      return productRepo.insert({
        slug: values.name.toLowerCase().replace(/\W+/g, "-"),
        priceCentavos: 100000,
        stockStatus: "in_stock",
        keySpec: "",
        description: "",
        imageUrl: null,
        imagePathname: null,
        isSample: false,
        sortOrder: (await productRepo.maxSortOrder()) + 1,
        ...values,
      });
    },
    products,
    categories,
  };
}

export type FakeStore = ReturnType<typeof createFakeStore>;
