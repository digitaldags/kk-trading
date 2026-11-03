import { deliveryState, grandTotal } from "@/lib/domain/documents";
import { ProductCodeTakenError } from "@/lib/domain/errors";
import type {
  AdminUser,
  Category,
  DeliveryReceipt,
  DeliveryReceiptWithItems,
  Product,
  Quotation,
  QuotationItem,
  QuotationWithItems,
  StoreSettings,
} from "@/lib/domain/types";
import type {
  AdminUserRepo,
  CategoryRepo,
  DeliveryReceiptRepo,
  LoginAttempt,
  LoginAttemptRepo,
  NewQuotation,
  NewQuotationItem,
  ProductRepo,
  PublishRepo,
  PublishedStore,
  QuotationRepo,
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
  /** The published copy (ticket 15): plain copies of the maps above, or null. */
  let published: {
    categories: Category[];
    products: Product[];
    settings: StoreSettings | null;
    publishedAt: Date;
  } | null = null;
  /** Makes the next repo write throw, to test what happens when a save fails. */
  let failNext: Error | null = null;

  function maybeFail() {
    if (failNext) {
      const error = failNext;
      failNext = null;
      throw error;
    }
  }

  // Quotations and delivery receipts (ticket 18), keyed by id.
  const quotationHeaders = new Map<string, Quotation>();
  const quotationLines = new Map<string, QuotationItem>();
  const receiptHeaders = new Map<string, DeliveryReceipt>();
  const receiptLines = new Map<
    string,
    { id: string; receiptId: string; quotationItemId: string; quantity: number }
  >();

  const productsIn = (categoryId: string) =>
    [...products.values()].filter((p) => p.categoryId === categoryId);

  /** The unique index on `lower(code)`, for codes that are filled in. */
  function checkCode(code: string | undefined, exceptId?: string) {
    if (!code) return;
    const taken = [...products.values()].some(
      (p) => p.id !== exceptId && p.code.toLowerCase() === code.toLowerCase(),
    );
    if (taken) throw new ProductCodeTakenError();
  }

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
    async setSortOrders(ids) {
      maybeFail();
      ids.forEach((id, index) => {
        const existing = categories.get(id);
        if (existing) categories.set(id, { ...existing, sortOrder: index });
      });
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
    async findByCode(code) {
      const lower = code.toLowerCase();
      return (
        [...products.values()].find((p) => p.code.toLowerCase() === lower) ??
        null
      );
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
      checkCode(values.code);
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
      checkCode(patch.code, id);
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
      return [
        ...products.values(),
        ...(published?.products ?? []),
        ...quotationLines.values(),
      ].some((p) => p.imageUrl === url);
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
    async isLogoInUse(url) {
      return settings?.logoUrl === url || published?.settings?.logoUrl === url;
    },
  };

  const withoutTimestamps = <T extends object>(rows: T[]) =>
    rows
      .map(
        ({
          createdAt: _c,
          updatedAt: _u,
          ...rest
        }: T & {
          createdAt?: Date;
          updatedAt?: Date;
        }) => rest,
      )
      .sort((a, b) =>
        String((a as { id?: string }).id).localeCompare(
          String((b as { id?: string }).id),
        ),
      );
  const comparable = (store: {
    categories: Category[];
    products: Product[];
    settings: StoreSettings | null;
  }) =>
    JSON.stringify({
      categories: withoutTimestamps(store.categories),
      products: withoutTimestamps(store.products),
      settings: store.settings && withoutTimestamps([store.settings])[0],
    });

  const publishRepo: PublishRepo = {
    async getPublished(): Promise<PublishedStore | null> {
      if (!published) return null;
      const snapshot = published;
      const ordered = [...snapshot.categories].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
      const byId = new Map(ordered.map((c) => [c.id, c]));
      const productList = snapshot.products
        .filter((p) => byId.has(p.categoryId))
        .map((p) => {
          const c = byId.get(p.categoryId)!;
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
      return {
        categories: ordered.map((c) => ({
          ...c,
          productCount: productList.filter((p) => p.categoryId === c.id).length,
        })),
        products: productList,
        settings: snapshot.settings,
        publishedAt: snapshot.publishedAt,
      };
    },
    async publish() {
      maybeFail();
      published = {
        categories: [...categories.values()].map((c) => ({ ...c })),
        products: [...products.values()].map((p) => ({ ...p })),
        settings: settings && { ...settings },
        publishedAt: clock.now(),
      };
    },
    async discard() {
      if (!published) return false;
      maybeFail();
      categories.clear();
      products.clear();
      for (const c of published.categories) categories.set(c.id, { ...c });
      for (const p of published.products) products.set(p.id, { ...p });
      if (published.settings) settings = { ...published.settings };
      return true;
    },
    async hasUnpublishedChanges() {
      if (!published) return true;
      return (
        comparable({
          categories: [...categories.values()],
          products: [...products.values()],
          settings,
        }) !== comparable(published)
      );
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

  // The documents fakes follow the database rules in drizzle/0004_documents.sql: unique
  // numbers ignoring case, the receipt triggers, and the restricting foreign keys.
  // lib/repositories/documents.parity.test.ts runs the same cases against both.

  const linesOf = (quotationId: string) =>
    [...quotationLines.values()]
      .filter((l) => l.quotationId === quotationId)
      .sort((a, b) => a.position - b.position);

  const deliveredOn = (lineId: string) =>
    [...receiptLines.values()]
      .filter((r) => r.quotationItemId === lineId)
      .reduce((sum, r) => sum + r.quantity, 0);

  const numberTaken = (
    rows: Iterable<{ id: string; number: string }>,
    number: string,
    exceptId?: string,
  ) =>
    [...rows].some(
      (r) =>
        r.id !== exceptId && r.number.toLowerCase() === number.toLowerCase(),
    );

  function quotationWithItems(id: string): QuotationWithItems | null {
    const header = quotationHeaders.get(id);
    return header
      ? { ...header, items: linesOf(id).map((l) => ({ ...l })) }
      : null;
  }

  function writeLines(quotationId: string, items: NewQuotationItem[]) {
    items.forEach((item, position) => {
      const id = newId();
      quotationLines.set(id, { ...item, id, quotationId, position });
    });
  }

  const quotationRepo: QuotationRepo = {
    async list({ status, q } = {}) {
      const needle = q?.toLowerCase();
      return [...quotationHeaders.values()]
        .filter((h) => !status || h.status === status)
        .filter(
          (h) =>
            !needle ||
            [h.number, h.customerName].some((t) =>
              t.toLowerCase().includes(needle),
            ),
        )
        .sort(
          (a, b) =>
            b.quoteDate.localeCompare(a.quoteDate) ||
            b.createdAt.getTime() - a.createdAt.getTime() ||
            a.id.localeCompare(b.id),
        )
        .map((h) => {
          const items = linesOf(h.id);
          const ordered = items.reduce((sum, l) => sum + l.quantity, 0);
          const delivered = items.reduce(
            (sum, l) => sum + Math.min(deliveredOn(l.id), l.quantity),
            0,
          );
          return {
            id: h.id,
            number: h.number,
            status: h.status,
            quoteDate: h.quoteDate,
            customerName: h.customerName,
            updatedAt: h.updatedAt,
            itemCount: items.length,
            grandTotalCentavos: grandTotal(items),
            deliveryState: deliveryState(ordered, delivered),
          };
        });
    },
    async findById(id) {
      return quotationWithItems(id);
    },
    async findByNumber(number) {
      const lower = number.toLowerCase();
      const found = [...quotationHeaders.values()].find(
        (h) => h.number.toLowerCase() === lower,
      );
      return found ? { ...found } : null;
    },
    async insert(header: NewQuotation, items) {
      maybeFail();
      if (numberTaken(quotationHeaders.values(), header.number)) {
        return { ok: false, reason: "duplicate_number" };
      }
      const id = newId();
      quotationHeaders.set(id, {
        ...header,
        id,
        completedAt: null,
        declinedAt: null,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      writeLines(id, items);
      return { ok: true, data: quotationWithItems(id)! };
    },
    async replace(id, header, items) {
      maybeFail();
      const existing = quotationHeaders.get(id);
      if (!existing) return { ok: true, data: null };
      if (numberTaken(quotationHeaders.values(), header.number, id)) {
        return { ok: false, reason: "duplicate_number" };
      }
      const lineIds = new Set(linesOf(id).map((l) => l.id));
      if (
        [...receiptLines.values()].some((r) => lineIds.has(r.quotationItemId))
      ) {
        throw new Error("restrict_violation");
      }
      quotationHeaders.set(id, {
        ...existing,
        ...header,
        updatedAt: clock.now(),
      });
      for (const lineId of lineIds) quotationLines.delete(lineId);
      writeLines(id, items);
      return { ok: true, data: quotationWithItems(id) };
    },
    async setStatus(id, from, to) {
      maybeFail();
      const existing = quotationHeaders.get(id);
      if (!existing || existing.status !== from) return null;
      const updated: Quotation = {
        ...existing,
        status: to,
        completedAt: to === "completed" ? clock.now() : null,
        declinedAt: to === "declined" ? clock.now() : null,
        updatedAt: clock.now(),
      };
      quotationHeaders.set(id, updated);
      return { ...updated };
    },
    async delete(id) {
      maybeFail();
      if (!quotationHeaders.has(id)) return false;
      if ([...receiptHeaders.values()].some((r) => r.quotationId === id)) {
        throw new Error("restrict_violation");
      }
      for (const line of linesOf(id)) quotationLines.delete(line.id);
      return quotationHeaders.delete(id);
    },
  };

  function receiptWithItems(
    receipt: DeliveryReceipt,
  ): DeliveryReceiptWithItems {
    return {
      ...receipt,
      items: [...receiptLines.values()]
        .filter((r) => r.receiptId === receipt.id)
        .map((r) => ({
          id: r.id,
          quotationItemId: r.quotationItemId,
          quantity: r.quantity,
          line: { ...quotationLines.get(r.quotationItemId)! },
        }))
        .sort((a, b) => a.line.position - b.line.position),
    };
  }

  const deliveryReceiptRepo: DeliveryReceiptRepo = {
    async listForQuotation(quotationId) {
      return [...receiptHeaders.values()]
        .filter((r) => r.quotationId === quotationId)
        .sort(
          (a, b) =>
            a.createdAt.getTime() - b.createdAt.getTime() ||
            a.id.localeCompare(b.id),
        )
        .map(receiptWithItems);
    },
    async deliveredByLine(quotationId) {
      // Lines no receipt delivers are left out, as in the SQL.
      const delivered = new Map<string, number>();
      for (const r of receiptLines.values()) {
        if (
          quotationLines.get(r.quotationItemId)?.quotationId !== quotationId
        ) {
          continue;
        }
        delivered.set(r.quotationItemId, deliveredOn(r.quotationItemId));
      }
      return delivered;
    },
    async findById(id) {
      const receipt = receiptHeaders.get(id);
      return receipt ? receiptWithItems(receipt) : null;
    },
    async findByNumber(number) {
      const lower = number.toLowerCase();
      const found = [...receiptHeaders.values()].find(
        (r) => r.number.toLowerCase() === lower,
      );
      return found ? { ...found } : null;
    },
    // All or nothing, in the order Postgres checks: the receipt's trigger, its number
    // index, then each line's trigger.
    async insert(header, items) {
      maybeFail();
      const quotation = quotationHeaders.get(header.quotationId);
      if (!quotation) throw new Error("foreign_key_violation");
      if (quotation.status !== "completed") {
        return { ok: false, reason: "not_completed" };
      }
      if (numberTaken(receiptHeaders.values(), header.number)) {
        return { ok: false, reason: "duplicate_number" };
      }
      const pending = new Map<string, number>();
      for (const item of items) {
        const line = quotationLines.get(item.quotationItemId);
        if (!line) throw new Error("foreign_key_violation");
        if (line.quotationId !== header.quotationId) {
          throw new Error("line_not_on_quotation");
        }
        if (pending.has(line.id)) throw new Error("unique_violation");
        const delivered = deliveredOn(line.id) + item.quantity;
        if (delivered > line.quantity) {
          return { ok: false, reason: "over_delivery" };
        }
        pending.set(line.id, item.quantity);
      }
      const id = newId();
      const receipt = { ...header, id, createdAt: clock.now() };
      receiptHeaders.set(id, receipt);
      for (const [quotationItemId, quantity] of pending) {
        const lineId = newId();
        receiptLines.set(lineId, {
          id: lineId,
          receiptId: id,
          quotationItemId,
          quantity,
        });
      }
      return { ok: true, data: receiptWithItems(receipt) };
    },
    async delete(id) {
      maybeFail();
      if (!receiptHeaders.has(id)) return false;
      for (const line of [...receiptLines.values()]) {
        if (line.receiptId === id) receiptLines.delete(line.id);
      }
      return receiptHeaders.delete(id);
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
    publishRepo,
    quotationRepo,
    deliveryReceiptRepo,
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
        code: values.name.toUpperCase().replace(/\W+/g, "-"),
        uom: "pcs",
        specs: "",
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
