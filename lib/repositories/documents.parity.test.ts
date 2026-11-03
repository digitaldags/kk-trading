import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSeededTestDb } from "@/lib/db/testing/pglite";
import type { Product } from "@/lib/domain/types";
import { createFakeStore } from "@/lib/services/testing/fakes";
import { createDeliveryReceiptRepo } from "./deliveryReceiptRepo";
import { createProductRepo } from "./productRepo";
import { createQuotationRepo } from "./quotationRepo";
import type {
  DeliveryReceiptRepo,
  NewQuotation,
  NewQuotationItem,
  QuotationRepo,
} from "./types";

// The service tests run on the in-memory fakes (lib/services/testing/fakes.ts), so the
// fakes must refuse what Postgres refuses. These cases run on both.

type Repos = {
  quotations: QuotationRepo;
  receipts: DeliveryReceiptRepo;
  chair: Product;
  desk: Product;
  close: () => Promise<void>;
};

const backends: [string, () => Promise<Repos>][] = [
  [
    "PGlite",
    async () => {
      const { db, client } = await createSeededTestDb();
      const all = await createProductRepo(db).listWithCategory();
      return {
        quotations: createQuotationRepo(db),
        receipts: createDeliveryReceiptRepo(db),
        chair: all.find((p) => p.code === "KK-CHAIR-01")!,
        desk: all.find((p) => p.code === "KK-DESK-01")!,
        close: () => client.close(),
      };
    },
  ],
  [
    "fakes",
    async () => {
      const store = createFakeStore();
      const office = await store.addCategory({ name: "Office" });
      return {
        quotations: store.quotationRepo,
        receipts: store.deliveryReceiptRepo,
        chair: await store.addProduct({ name: "Chair", categoryId: office.id }),
        desk: await store.addProduct({ name: "Desk", categoryId: office.id }),
        close: async () => {},
      };
    },
  ],
];

const header = (number: string): NewQuotation => ({
  number,
  status: "draft",
  quoteDate: "2026-10-28",
  customerName: "Acme Gym",
  customerAddress: "",
  customerTin: "",
  deliveryAddress: "",
  deliveryTerm: "",
  paymentTerms: "",
  remarks: "",
  leadTime: "",
  notes: "",
  acknowledgement: "",
});

const line = (product: Product, quantity: number): NewQuotationItem => ({
  productId: product.id,
  code: product.code,
  name: product.name,
  specs: product.specs,
  uom: product.uom,
  imageUrl: product.imageUrl,
  unitPriceCentavos: product.priceCentavos,
  quantity,
});

const receiptHeader = (quotationId: string, number: string) => ({
  quotationId,
  number,
  receiptDate: "2026-10-28",
  deliveryAddress: "",
});

describe.each(backends)("documents rules on %s", (_name, open) => {
  // Opened in a hook: seeding PGlite can take longer than a test's timeout under coverage.
  let current: Repos;
  beforeEach(async () => {
    current = await open();
  });
  afterEach(() => current.close());

  const withRepos = (test: (repos: Repos) => Promise<void>) => test(current);

  /** A quotation with 8 chairs and 2 desks, completed unless `draft`. */
  async function quotation(
    { quotations, chair, desk }: Repos,
    number = "Q-1",
    { draft = false } = {},
  ) {
    const result = await quotations.insert(header(number), [
      line(chair, 8),
      line(desk, 2),
    ]);
    if (!result.ok) throw new Error(result.reason);
    if (!draft)
      await quotations.setStatus(result.data.id, "draft", "completed");
    return result.data;
  }

  it("refuses a quotation number in another case, on insert and replace", () =>
    withRepos(async (repos) => {
      await quotation(repos, "Q-1");
      const second = await quotation(repos, "Q-2", { draft: true });
      expect(await repos.quotations.insert(header("q-1"), [])).toEqual({
        ok: false,
        reason: "duplicate_number",
      });
      expect(
        await repos.quotations.replace(second.id, header("q-1"), []),
      ).toEqual({ ok: false, reason: "duplicate_number" });
      // Its own number, in another case, is fine.
      const own = await repos.quotations.replace(second.id, header("q-2"), []);
      expect(own.ok).toBe(true);
    }));

  it("moves the status only from the status the caller saw", () =>
    withRepos(async (repos) => {
      const q = await quotation(repos, "Q-1", { draft: true });
      expect(
        (await repos.quotations.setStatus(q.id, "draft", "declined"))?.status,
      ).toBe("declined");
      expect(
        await repos.quotations.setStatus(q.id, "draft", "completed"),
      ).toBeNull();
    }));

  it("refuses a receipt for a quotation that isn't completed", () =>
    withRepos(async (repos) => {
      const q = await quotation(repos, "Q-1", { draft: true });
      expect(
        await repos.receipts.insert(receiptHeader(q.id, "DR-1"), [
          { quotationItemId: q.items[0]!.id, quantity: 1 },
        ]),
      ).toEqual({ ok: false, reason: "not_completed" });
    }));

  it("refuses over-delivery across two receipts, and writes nothing", () =>
    withRepos(async (repos) => {
      const q = await quotation(repos);
      const [chairLine, deskLine] = q.items.map((i) => i.id);
      const first = await repos.receipts.insert(receiptHeader(q.id, "DR-1"), [
        { quotationItemId: chairLine!, quantity: 6 },
      ]);
      expect(first.ok).toBe(true);
      expect(
        await repos.receipts.insert(receiptHeader(q.id, "DR-2"), [
          { quotationItemId: deskLine!, quantity: 1 },
          { quotationItemId: chairLine!, quantity: 3 },
        ]),
      ).toEqual({ ok: false, reason: "over_delivery" });
      expect(await repos.receipts.findByNumber("DR-2")).toBeNull();
      expect(await repos.receipts.deliveredByLine(q.id)).toEqual(
        new Map([[chairLine, 6]]),
      );
      const [summary] = await repos.quotations.list();
      expect(summary?.deliveryState).toBe("partial");
    }));

  it("refuses a receipt number in another case", () =>
    withRepos(async (repos) => {
      const q = await quotation(repos);
      const items = [{ quotationItemId: q.items[0]!.id, quantity: 1 }];
      await repos.receipts.insert(receiptHeader(q.id, "DR-1"), items);
      expect(
        await repos.receipts.insert(receiptHeader(q.id, "dr-1"), items),
      ).toEqual({ ok: false, reason: "duplicate_number" });
    }));

  // Rethrown, not a reason: the services never send such a line.
  it("throws for a line from another quotation, and writes nothing", () =>
    withRepos(async (repos) => {
      const a = await quotation(repos, "Q-1");
      const b = await quotation(repos, "Q-2");
      await expect(
        repos.receipts.insert(receiptHeader(a.id, "DR-1"), [
          { quotationItemId: b.items[0]!.id, quantity: 1 },
        ]),
      ).rejects.toThrow();
      expect(await repos.receipts.findByNumber("DR-1")).toBeNull();
    }));

  it("frees the quantities of a deleted receipt, so it can be made again", () =>
    withRepos(async (repos) => {
      const q = await quotation(repos);
      const items = [{ quotationItemId: q.items[0]!.id, quantity: 8 }];
      const first = await repos.receipts.insert(
        receiptHeader(q.id, "DR-1"),
        items,
      );
      if (!first.ok) throw new Error(first.reason);
      expect(await repos.receipts.delete(first.data.id)).toBe(true);
      expect(await repos.receipts.deliveredByLine(q.id)).toEqual(new Map());
      const again = await repos.receipts.insert(
        receiptHeader(q.id, "DR-1"),
        items,
      );
      expect(again.ok).toBe(true);
      expect((await repos.quotations.list())[0]?.deliveryState).toBe("partial");
    }));

  it("won't replace or delete a quotation once a receipt delivers it", () =>
    withRepos(async (repos) => {
      const q = await quotation(repos);
      await repos.receipts.insert(receiptHeader(q.id, "DR-1"), [
        { quotationItemId: q.items[0]!.id, quantity: 1 },
      ]);
      await expect(
        repos.quotations.replace(q.id, header("Q-1"), []),
      ).rejects.toThrow();
      await expect(repos.quotations.delete(q.id)).rejects.toThrow();
      expect((await repos.quotations.findById(q.id))?.items).toHaveLength(2);
    }));

  it("totals and states the list the same way", () =>
    withRepos(async (repos) => {
      const q = await quotation(repos);
      await repos.receipts.insert(receiptHeader(q.id, "DR-1"), [
        { quotationItemId: q.items[0]!.id, quantity: 8 },
        { quotationItemId: q.items[1]!.id, quantity: 2 },
      ]);
      const [summary] = await repos.quotations.list({ q: "q-1" });
      expect(summary).toMatchObject({
        itemCount: 2,
        grandTotalCentavos:
          8 * repos.chair.priceCentavos + 2 * repos.desk.priceCentavos,
        deliveryState: "full",
      });
      expect(await repos.quotations.list({ status: "draft" })).toEqual([]);
    }));
});
