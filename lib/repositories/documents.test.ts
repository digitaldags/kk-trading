import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import {
  createSeededTestDb,
  createTestDbAt,
  runMigrationSql,
  TEST_ADMIN,
} from "@/lib/db/testing/pglite";
import { seed } from "@/lib/db/seed";
import type { Product } from "@/lib/domain/types";
import { createDeliveryReceiptRepo } from "./deliveryReceiptRepo";
import { createProductRepo } from "./productRepo";
import { createPublishRepo } from "./publishRepo";
import { createQuotationRepo } from "./quotationRepo";
import type { NewQuotation, NewQuotationItem } from "./types";

// Quotations and delivery receipts (ticket 18) on real Postgres (PGlite), with the seed
// loaded and the triggers from drizzle/0004_documents.sql. Each test gets its own database.

let db: Db;
let client: PGlite;
let quotations: ReturnType<typeof createQuotationRepo>;
let receipts: ReturnType<typeof createDeliveryReceiptRepo>;
let products: ReturnType<typeof createProductRepo>;
let chair: Product;
let desk: Product;

beforeEach(async () => {
  ({ db, client } = await createSeededTestDb());
  quotations = createQuotationRepo(db);
  receipts = createDeliveryReceiptRepo(db);
  products = createProductRepo(db);
  const all = await products.listWithCategory();
  chair = all.find((p) => p.code === "KK-CHAIR-01")!;
  desk = all.find((p) => p.code === "KK-DESK-01")!;
});

afterEach(async () => {
  await client.close();
});

const header = (overrides: Partial<NewQuotation> = {}): NewQuotation => ({
  number: "Q-2026-001",
  status: "draft",
  quoteDate: "2026-10-28",
  customerName: "Acme Gym",
  customerAddress: "Quezon City",
  customerTin: "",
  deliveryAddress: "Quezon City",
  deliveryTerm: "",
  paymentTerms: "",
  remarks: "PRICES ARE VAT-EXCLUSIVE",
  leadTime: "",
  notes: "",
  acknowledgement: "",
  ...overrides,
});

const line = (
  product: Product,
  overrides: Partial<NewQuotationItem> = {},
): NewQuotationItem => ({
  productId: product.id,
  code: product.code,
  name: product.name,
  specs: product.specs,
  uom: product.uom,
  imageUrl: product.imageUrl,
  unitPriceCentavos: product.priceCentavos,
  quantity: 2,
  ...overrides,
});

/** A quotation as the insert returns it; fails the test if it was refused. */
async function quotation(
  overrides: Partial<NewQuotation> = {},
  items: NewQuotationItem[] = [line(chair), line(desk, { quantity: 1 })],
) {
  const result = await quotations.insert(header(overrides), items);
  if (!result.ok) throw new Error(result.reason);
  return result.data;
}

/** A completed quotation, ready for receipts. */
async function completed(overrides: Partial<NewQuotation> = {}) {
  const q = await quotation(overrides);
  await quotations.setStatus(q.id, "draft", "completed");
  return q;
}

const receipt = (quotationId: string, number = "DR-001") => ({
  quotationId,
  number,
  receiptDate: "2026-10-29",
  deliveryAddress: "Quezon City",
});

describe("quotationRepo", () => {
  it("writes the header and the lines in order, and reads them back", async () => {
    const q = await quotation();
    expect(q).toMatchObject({
      number: "Q-2026-001",
      status: "draft",
      quoteDate: "2026-10-28",
      completedAt: null,
    });
    expect(q.items.map((i) => [i.position, i.code, i.quantity])).toEqual([
      [0, "KK-CHAIR-01", 2],
      [1, "KK-DESK-01", 1],
    ]);
    expect(await quotations.findById(q.id)).toEqual(q);
    expect((await quotations.findByNumber("q-2026-001"))?.id).toBe(q.id);
  });

  it("refuses a number another quotation uses, ignoring case, on insert and replace", async () => {
    const first = await quotation();
    expect(
      await quotations.insert(header({ number: "q-2026-001" }), [line(chair)]),
    ).toEqual({ ok: false, reason: "duplicate_number" });

    const second = await quotation({ number: "Q-2026-002" });
    expect(
      await quotations.replace(second.id, header({ number: "Q-2026-001" }), []),
    ).toEqual({ ok: false, reason: "duplicate_number" });
    // Neither write changed anything.
    expect((await quotations.findById(second.id))?.items).toHaveLength(2);
    expect((await quotations.list()).map((s) => s.number).sort()).toEqual([
      first.number,
      "Q-2026-002",
    ]);
  });

  it("replaces the header and every line in one go", async () => {
    const q = await quotation();
    const result = await quotations.replace(
      q.id,
      header({ customerName: "Beta Fitness" }),
      [line(desk, { quantity: 5 })],
    );
    expect(result.ok && result.data).toMatchObject({
      customerName: "Beta Fitness",
      items: [{ position: 0, productId: desk.id, quantity: 5 }],
    });
    expect(
      await quotations.replace(
        "00000000-0000-4000-8000-999999999999",
        header(),
        [],
      ),
    ).toEqual({ ok: true, data: null });
  });

  it("refuses the same product twice on one quotation", async () => {
    await expect(
      quotations.insert(header(), [line(chair), line(chair)]),
    ).rejects.toThrow();
    expect(await quotations.list()).toEqual([]);
  });

  it("moves the status only from the one the caller saw, stamping the time", async () => {
    const q = await quotation();
    const done = await quotations.setStatus(q.id, "draft", "completed");
    expect(done).toMatchObject({ status: "completed", declinedAt: null });
    expect(done?.completedAt).toBeInstanceOf(Date);
    // Someone else already moved it on.
    expect(await quotations.setStatus(q.id, "draft", "declined")).toBeNull();
    expect(
      await quotations.setStatus(q.id, "completed", "draft"),
    ).toMatchObject({ status: "draft", completedAt: null });
  });

  it("deletes a quotation with its lines, but not one with receipts", async () => {
    const draft = await quotation();
    expect(await quotations.delete(draft.id)).toBe(true);
    expect(await quotations.findById(draft.id)).toBeNull();
    expect(await quotations.delete(draft.id)).toBe(false);

    const done = await completed({ number: "Q-2026-002" });
    await receipts.insert(receipt(done.id), [
      { quotationItemId: done.items[0]!.id, quantity: 1 },
    ]);
    await expect(quotations.delete(done.id)).rejects.toThrow();
  });
});

describe("quotationRepo.list", () => {
  it("adds up totals exactly, past the int4 range", async () => {
    await quotation({ number: "Q-1" }, [
      line(chair, { unitPriceCentavos: 274500, quantity: 20 }),
    ]);
    await quotation({ number: "Q-2" }, [
      // 3,000 × ₱10,000,000.00: 3 × 10^12 centavos, far past 2^31.
      line(chair, { unitPriceCentavos: 1_000_000_000, quantity: 3000 }),
      line(desk, { unitPriceCentavos: 1, quantity: 1 }),
    ]);
    const totals = Object.fromEntries(
      (await quotations.list()).map((s) => [s.number, s.grandTotalCentavos]),
    );
    expect(totals).toEqual({ "Q-1": 5_490_000, "Q-2": 3_000_000_000_001 });
  });

  it("orders by quote date, newest first, then newest created", async () => {
    await quotation({ number: "OLD", quoteDate: "2026-01-05" });
    await quotation({ number: "NEW-A", quoteDate: "2026-10-28" });
    await quotation({ number: "NEW-B", quoteDate: "2026-10-28" });
    expect((await quotations.list()).map((s) => s.number)).toEqual([
      "NEW-B",
      "NEW-A",
      "OLD",
    ]);
  });

  it("filters by status, and searches the number and customer, ignoring case", async () => {
    await quotation({ number: "Q-100", customerName: "Acme Gym" });
    const done = await completed({
      number: "Q-200",
      customerName: "Beta Desk",
    });
    const numbers = (rows: { number: string }[]) => rows.map((r) => r.number);

    expect(numbers(await quotations.list({ status: "completed" }))).toEqual([
      done.number,
    ]);
    expect(numbers(await quotations.list({ q: "acme" }))).toEqual(["Q-100"]);
    expect(numbers(await quotations.list({ q: "q-2" }))).toEqual(["Q-200"]);
    expect(await quotations.list({ q: "%" })).toEqual([]);
    expect(await quotations.list({ q: "_" })).toEqual([]);
  });

  it("reports the delivery state and the line count", async () => {
    const q = await completed();
    const [chairLine, deskLine] = q.items;
    const state = async () => (await quotations.list())[0];

    expect(await state()).toMatchObject({
      itemCount: 2,
      deliveryState: "none",
    });
    await receipts.insert(receipt(q.id, "DR-1"), [
      { quotationItemId: chairLine!.id, quantity: 2 },
    ]);
    expect((await state())?.deliveryState).toBe("partial");
    await receipts.insert(receipt(q.id, "DR-2"), [
      { quotationItemId: deskLine!.id, quantity: 1 },
    ]);
    expect((await state())?.deliveryState).toBe("full");
  });
});

describe("deliveryReceiptRepo", () => {
  it("writes a receipt with its lines, joined to the quotation lines it prints", async () => {
    const q = await completed();
    const result = await receipts.insert(receipt(q.id), [
      { quotationItemId: q.items[0]!.id, quantity: 1 },
    ]);
    expect(result.ok).toBe(true);
    const saved = result.ok ? result.data : null;
    expect(saved).toMatchObject({
      number: "DR-001",
      receiptDate: "2026-10-29",
      items: [{ quantity: 1, line: { code: "KK-CHAIR-01", quantity: 2 } }],
    });
    expect(await receipts.findById(saved!.id)).toEqual(saved);
    expect((await receipts.findByNumber("dr-001"))?.id).toBe(saved!.id);
    expect(await receipts.listForQuotation(q.id)).toEqual([saved]);
  });

  it("refuses a number another receipt uses, ignoring case, but allows a quotation's", async () => {
    const q = await completed();
    const lineId = q.items[0]!.id;
    expect(
      (
        await receipts.insert(receipt(q.id, q.number), [
          { quotationItemId: lineId, quantity: 1 },
        ])
      ).ok,
    ).toBe(true);
    expect(
      await receipts.insert(receipt(q.id, q.number.toLowerCase()), [
        { quotationItemId: lineId, quantity: 1 },
      ]),
    ).toEqual({ ok: false, reason: "duplicate_number" });
  });

  it("refuses delivering more than ordered in one receipt, writing nothing", async () => {
    const q = await completed();
    expect(
      await receipts.insert(receipt(q.id), [
        { quotationItemId: q.items[1]!.id, quantity: 1 },
        { quotationItemId: q.items[0]!.id, quantity: 3 },
      ]),
    ).toEqual({ ok: false, reason: "over_delivery" });
    // The first line was fine, but the whole receipt was rolled back.
    expect(await receipts.listForQuotation(q.id)).toEqual([]);
    expect(await receipts.findByNumber("DR-001")).toBeNull();
    expect(await receipts.deliveredByLine(q.id)).toEqual(new Map());
  });

  it("refuses delivering more than ordered across two receipts", async () => {
    const q = await completed();
    const chairLine = q.items[0]!.id;
    await receipts.insert(receipt(q.id, "DR-1"), [
      { quotationItemId: chairLine, quantity: 1 },
    ]);
    expect(
      await receipts.insert(receipt(q.id, "DR-2"), [
        { quotationItemId: chairLine, quantity: 2 },
      ]),
    ).toEqual({ ok: false, reason: "over_delivery" });
    expect(await receipts.deliveredByLine(q.id)).toEqual(
      new Map([[chairLine, 1]]),
    );
    expect(await receipts.listForQuotation(q.id)).toHaveLength(1);
  });

  it("refuses a receipt for a draft or a declined quotation", async () => {
    const draft = await quotation();
    const lineOf = (q: typeof draft) => [
      { quotationItemId: q.items[0]!.id, quantity: 1 },
    ];
    expect(await receipts.insert(receipt(draft.id), lineOf(draft))).toEqual({
      ok: false,
      reason: "not_completed",
    });

    const declined = await quotation({ number: "Q-2026-002" });
    await quotations.setStatus(declined.id, "draft", "declined");
    expect(
      await receipts.insert(receipt(declined.id), lineOf(declined)),
    ).toEqual({ ok: false, reason: "not_completed" });

    await quotations.setStatus(draft.id, "draft", "completed");
    expect((await receipts.insert(receipt(draft.id), lineOf(draft))).ok).toBe(
      true,
    );
  });

  it("refuses a line from another quotation", async () => {
    const mine = await completed();
    const other = await completed({ number: "Q-2026-002" });
    await expect(
      receipts.insert(receipt(mine.id), [
        { quotationItemId: other.items[0]!.id, quantity: 1 },
      ]),
    ).rejects.toThrow();
    expect(await receipts.listForQuotation(mine.id)).toEqual([]);
  });

  it("counts a deleted receipt's quantities as undelivered again", async () => {
    const q = await completed();
    const result = await receipts.insert(receipt(q.id), [
      { quotationItemId: q.items[0]!.id, quantity: 2 },
      { quotationItemId: q.items[1]!.id, quantity: 1 },
    ]);
    const id = result.ok ? result.data.id : "";
    expect((await quotations.list())[0]?.deliveryState).toBe("full");

    expect(await receipts.delete(id)).toBe(true);
    expect(await receipts.delete(id)).toBe(false);
    expect(await receipts.deliveredByLine(q.id)).toEqual(new Map());
    expect((await quotations.list())[0]?.deliveryState).toBe("none");
    // The full quantity can be delivered again.
    expect(
      (
        await receipts.insert(receipt(q.id, "DR-002"), [
          { quotationItemId: q.items[0]!.id, quantity: 2 },
        ])
      ).ok,
    ).toBe(true);
  });
});

describe("documents and draft and publish", () => {
  it("Discard succeeds with quotations present, and their lines keep their product", async () => {
    const publish = createPublishRepo(db);
    await publish.publish();
    const q = await quotation();
    await products.update(chair.id, { name: "Renamed chair" });

    expect(await publish.discard()).toBe(true);
    const [chairLine] = (await quotations.findById(q.id))!.items;
    expect(chairLine).toMatchObject({
      productId: chair.id,
      name: "Ergonomic mesh chair",
    });
    expect((await products.findById(chair.id))?.name).toBe(
      "Ergonomic mesh chair",
    );
    // Quotations aren't part of the store, so they don't make it unpublished.
    expect(await publish.hasUnpublishedChanges()).toBe(false);
  });

  it("keeps a photo in use while only a quotation line prints it", async () => {
    const publish = createPublishRepo(db);
    const url =
      "https://store.public.blob.vercel-storage.com/products/chair-photo.webp";
    await products.update(chair.id, {
      imageUrl: url,
      imagePathname: "products/chair-photo.webp",
    });
    const q = await quotation({}, [line({ ...chair, imageUrl: url })]);

    // The product drops the photo, and that's published: only the line still has it.
    await products.update(chair.id, { imageUrl: null, imagePathname: null });
    await publish.publish();
    expect(await products.isImageInUse(url)).toBe(true);

    await quotations.delete(q.id);
    expect(await products.isImageInUse(url)).toBe(false);
  });
});

describe("the documents migration (0004) on existing data", () => {
  it("adds the document tables to a store migrated to 0003", async () => {
    const old = await createTestDbAt("0003_optional_product_code");
    try {
      // The seed writes today's store_settings columns. 0005 only adds the logo size
      // there (and to the snapshot), independent of 0004, so it can run first.
      await runMigrationSql(old.client, "0005_logo_size");
      await seed(old.db, TEST_ADMIN);
      await runMigrationSql(old.client, "0004_documents");
      const [product] = await createProductRepo(old.db).listWithCategory();
      const result = await createQuotationRepo(old.db).insert(header(), [
        line(product!),
      ]);
      expect(result.ok).toBe(true);
      expect(await createPublishRepo(old.db).hasUnpublishedChanges()).toBe(
        false,
      );
    } finally {
      await old.client.close();
    }
  });
});
