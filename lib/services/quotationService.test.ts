import { beforeEach, describe, expect, it } from "vitest";
import { QUOTATION_DEFAULTS } from "@/lib/domain/documents";
import type { QuotationInput } from "@/lib/domain/schemas";
import type { Product } from "@/lib/domain/types";
import { formatPesoExact } from "@/lib/format";
import {
  ALREADY_DECIDED,
  createQuotationService,
  LOCKED,
  NO_ITEMS,
  ONLY_DRAFTS_DELETED,
  PRODUCT_GONE,
} from "./quotationService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

let store: FakeStore;
let service: ReturnType<typeof createQuotationService>;
let chair: Product;
let bench: Product;
let rack: Product;

const NOT_FOUND = "That quotation no longer exists.";
const TAKEN = "Another quotation already uses this number.";
const UNKNOWN_ID = "00000000-0000-4000-8000-999999999999";

beforeEach(async () => {
  store = createFakeStore();
  service = createQuotationService({
    quotations: store.quotationRepo,
    receipts: store.deliveryReceiptRepo,
    products: store.productRepo,
    now: store.clock.now,
  });
  const office = await store.addCategory({ name: "Office" });
  chair = await store.addProduct({
    name: "Ergonomic mesh chair",
    categoryId: office.id,
    code: "KK-CHAIR-01",
    specs: "Mesh back\n3D armrests",
    priceCentavos: 845000,
    imageUrl: "https://x.public.blob.vercel-storage.com/products/chair.webp",
  });
  bench = await store.addProduct({
    name: "Adjustable bench",
    categoryId: office.id,
    priceCentavos: 615500,
    uom: "unit",
  });
  rack = await store.addProduct({
    name: "Dumbbell rack",
    categoryId: office.id,
    priceCentavos: 274500,
    uom: "set",
  });
});

const input = (overrides: Partial<QuotationInput> = {}): QuotationInput => ({
  number: "Q-2026-001",
  quoteDate: "2026-10-27",
  customerName: "Acme Gym",
  deliveryAddress: "Quezon City",
  ...overrides,
});

/** The sample quotation's lines. */
const sampleItems = () => [
  { productId: chair.id, quantity: 2, unitPrice: "8,450" },
  { productId: bench.id, quantity: 5, unitPrice: "6155" },
  { productId: rack.id, quantity: 20, unitPrice: 2745 },
];

async function draft(overrides: Partial<QuotationInput> = {}) {
  const result = await service.createDraft(
    input({ items: sampleItems(), ...overrides }),
  );
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.data;
}

describe("quotationService.newDraftDefaults", () => {
  it("starts with today's date in Manila, the default text and no number", () => {
    store.clock.set(new Date("2026-10-27T20:00:00Z"));
    expect(service.newDraftDefaults()).toEqual({
      number: "",
      quoteDate: "2026-10-28",
      customerName: "",
      customerAddress: "",
      customerTin: "",
      deliveryAddress: "",
      ...QUOTATION_DEFAULTS,
      items: [],
    });
  });
});

describe("quotationService.createDraft", () => {
  it("copies each product's code, name, specs, unit and photo, with the typed price", async () => {
    const quotation = await draft();
    expect(quotation.status).toBe("draft");
    expect(quotation.items[0]).toMatchObject({
      productId: chair.id,
      code: "KK-CHAIR-01",
      name: "Ergonomic mesh chair",
      specs: "Mesh back\n3D armrests",
      uom: "pcs",
      imageUrl: chair.imageUrl,
      unitPriceCentavos: 845000,
      quantity: 2,
      position: 0,
    });
    expect(quotation.items.map((i) => i.uom)).toEqual(["pcs", "unit", "set"]);
  });

  it("totals the sample to ₱102,575.00", async () => {
    await draft();
    const [row] = await service.list();
    expect(row?.grandTotalCentavos).toBe(10257500);
    expect(formatPesoExact(row!.grandTotalCentavos)).toBe("₱102,575.00");
    expect(row?.itemCount).toBe(3);
  });

  it("saves a draft with no items", async () => {
    const result = await service.createDraft(input());
    expect(result.ok && result.data.items).toEqual([]);
  });

  it("rejects a number another draft has in another case", async () => {
    await draft({ number: "Q-2026-001" });
    const result = await service.createDraft(input({ number: "q-2026-001" }));
    expect(result).toEqual({ ok: false, fieldErrors: { number: TAKEN } });
    expect(await service.list()).toHaveLength(1);
  });

  it("maps the repository's duplicate number to the same error", async () => {
    await draft({ number: "Q-1" });
    // Another admin saved the number after the check: the unique index refuses it.
    store.quotationRepo.findByNumber = async () => null;
    const result = await service.createDraft(input({ number: "q-1" }));
    expect(result).toEqual({ ok: false, fieldErrors: { number: TAKEN } });
  });

  it("refuses a product that's no longer in the catalog, under its row", async () => {
    await store.productRepo.delete(bench.id);
    const result = await service.createDraft(input({ items: sampleItems() }));
    expect(result).toEqual({
      ok: false,
      fieldErrors: { "items.1": PRODUCT_GONE },
    });
  });

  it("puts line errors under their row", async () => {
    const result = await service.createDraft(
      input({
        number: "",
        items: [
          { productId: chair.id, quantity: 1, unitPrice: 1 },
          { productId: bench.id, quantity: 0, unitPrice: 1 },
          { productId: chair.id, quantity: 1, unitPrice: 1 },
        ],
      }),
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        number: "Enter the quotation number.",
        "items.1": "Enter a whole number of 1 or more.",
        "items.2": "This product is already on the quotation.",
      },
    });
  });

  it("looks products up in the admin's catalog, not the published store", async () => {
    // Nothing is published, yet the draft product can go on a quotation.
    expect(await store.publishRepo.getPublished()).toBeNull();
    expect((await draft()).items).toHaveLength(3);
  });
});

describe("quotationService.updateDraft", () => {
  it("rewrites the header and the lines of a draft", async () => {
    const quotation = await draft();
    const result = await service.updateDraft(
      quotation.id,
      input({
        customerName: "Beta Fitness",
        items: [{ productId: rack.id, quantity: 4, unitPrice: "2,500" }],
      }),
    );
    expect(result.ok && result.data).toMatchObject({
      customerName: "Beta Fitness",
      items: [{ productId: rack.id, quantity: 4, unitPriceCentavos: 250000 }],
    });
  });

  it("keeps its own number, in any case", async () => {
    const quotation = await draft({ number: "Q-7" });
    const result = await service.updateDraft(
      quotation.id,
      input({ number: "q-7" }),
    );
    expect(result.ok && result.data.number).toBe("q-7");
  });

  it("rejects another draft's number in another case", async () => {
    await draft({ number: "Q-1" });
    const second = await draft({ number: "Q-2" });
    const result = await service.updateDraft(
      second.id,
      input({ number: "q-1" }),
    );
    expect(result).toEqual({ ok: false, fieldErrors: { number: TAKEN } });
  });

  it("refuses a completed or declined quotation", async () => {
    const completed = await draft({ number: "Q-1" });
    await service.complete(completed.id);
    const declined = await draft({ number: "Q-2" });
    await service.decline(declined.id);
    for (const { id } of [completed, declined]) {
      expect(await service.updateDraft(id, input({ number: "Q-9" }))).toEqual({
        ok: false,
        fieldErrors: {},
        formError: LOCKED,
      });
    }
  });

  it("reports an unknown or malformed id", async () => {
    for (const id of [UNKNOWN_ID, "not-an-id"]) {
      expect(await service.updateDraft(id, input())).toMatchObject({
        formError: NOT_FOUND,
      });
    }
  });

  it("reports a quotation deleted while it was saved", async () => {
    const quotation = await draft();
    store.quotationRepo.replace = async () => ({ ok: true, data: null });
    expect(await service.updateDraft(quotation.id, input())).toMatchObject({
      formError: NOT_FOUND,
    });
  });

  it("never rewrites a line from the catalog", async () => {
    const quotation = await draft();
    await store.productRepo.update(chair.id, {
      name: "Mesh chair v2",
      code: "KK-CHAIR-02",
      specs: "New specs",
      priceCentavos: 999900,
      imageUrl: "https://x.public.blob.vercel-storage.com/products/new.webp",
    });

    const stored = await service.get(quotation.id);
    expect(stored?.items[0]).toMatchObject({
      name: "Ergonomic mesh chair",
      code: "KK-CHAIR-01",
      specs: "Mesh back\n3D armrests",
      unitPriceCentavos: 845000,
      imageUrl: chair.imageUrl,
    });

    // A later save keeps the stored copy and takes only the new quantity and price.
    const saved = await service.updateDraft(
      quotation.id,
      input({
        items: [{ productId: chair.id, quantity: 3, unitPrice: "8,000" }],
      }),
    );
    expect(saved.ok && saved.data.items).toEqual([
      expect.objectContaining({
        name: "Ergonomic mesh chair",
        code: "KK-CHAIR-01",
        imageUrl: chair.imageUrl,
        quantity: 3,
        unitPriceCentavos: 800000,
      }),
    ]);
    // The old photo is still in use, so it's never deleted.
    expect(await store.productRepo.isImageInUse(chair.imageUrl!)).toBe(true);
  });

  it("keeps a line whose product was deleted from the catalog", async () => {
    const quotation = await draft();
    await store.productRepo.delete(chair.id);
    const result = await service.updateDraft(
      quotation.id,
      input({ items: sampleItems() }),
    );
    expect(result.ok && result.data.items[0]?.name).toBe(
      "Ergonomic mesh chair",
    );
  });
});

describe("quotationService.complete and decline", () => {
  it("completes a draft once", async () => {
    const quotation = await draft();
    const result = await service.complete(quotation.id);
    expect(result.ok && result.data).toMatchObject({
      status: "completed",
      completedAt: expect.any(Date),
      declinedAt: null,
    });
    expect(await service.complete(quotation.id)).toMatchObject({
      formError: ALREADY_DECIDED,
    });
    expect(await service.decline(quotation.id)).toMatchObject({
      formError: ALREADY_DECIDED,
    });
  });

  it("refuses to complete an empty draft", async () => {
    const quotation = await draft({ items: [] });
    expect(await service.complete(quotation.id)).toEqual({
      ok: false,
      fieldErrors: {},
      formError: NO_ITEMS,
    });
    expect((await service.get(quotation.id))?.status).toBe("draft");
  });

  it("declines a draft, even an empty one", async () => {
    const quotation = await draft({ items: [] });
    const result = await service.decline(quotation.id);
    expect(result.ok && result.data.status).toBe("declined");
  });

  it("loses the race to another admin", async () => {
    const quotation = await draft();
    // The other admin's change lands between the read and the status update.
    await store.quotationRepo.setStatus(quotation.id, "draft", "declined");
    store.quotationRepo.findById = async () => ({
      ...quotation,
      status: "draft",
    });
    expect(await service.complete(quotation.id)).toMatchObject({
      formError: ALREADY_DECIDED,
    });
  });

  it("reports an unknown id", async () => {
    expect(await service.complete(UNKNOWN_ID)).toMatchObject({
      formError: NOT_FOUND,
    });
    expect(await service.decline("nope")).toMatchObject({
      formError: NOT_FOUND,
    });
  });
});

describe("quotationService.deleteDraft", () => {
  it("deletes a draft", async () => {
    const quotation = await draft();
    expect(await service.deleteDraft(quotation.id)).toEqual({
      ok: true,
      data: { id: quotation.id },
    });
    expect(await service.get(quotation.id)).toBeNull();
  });

  it("only deletes drafts", async () => {
    const quotation = await draft();
    await service.complete(quotation.id);
    expect(await service.deleteDraft(quotation.id)).toMatchObject({
      formError: ONLY_DRAFTS_DELETED,
    });
  });

  it("reports an unknown id, or one deleted meanwhile", async () => {
    expect(await service.deleteDraft(UNKNOWN_ID)).toMatchObject({
      formError: NOT_FOUND,
    });
    const quotation = await draft();
    store.quotationRepo.delete = async () => false;
    expect(await service.deleteDraft(quotation.id)).toMatchObject({
      formError: NOT_FOUND,
    });
  });
});

describe("quotationService.list, get and progress", () => {
  it("filters by status and search, dropping bad filters", async () => {
    const a = await draft({ number: "Q-1", customerName: "Acme Gym" });
    await draft({ number: "Q-2", customerName: "Beta Office" });
    await service.complete(a.id);

    const numbers = async (filter: { status?: string; q?: string }) =>
      (await service.list(filter)).map((q) => q.number).sort();
    expect(await numbers({})).toEqual(["Q-1", "Q-2"]);
    expect(await numbers({ status: "completed" })).toEqual(["Q-1"]);
    expect(await numbers({ status: "bogus" })).toEqual(["Q-1", "Q-2"]);
    expect(await numbers({ q: "  beta " })).toEqual(["Q-2"]);
    expect(await numbers({ q: "q-1" })).toEqual(["Q-1"]);
    expect(await numbers({ q: "   " })).toEqual(["Q-1", "Q-2"]);
  });

  it("gets null for an unknown or malformed id", async () => {
    expect(await service.get(UNKNOWN_ID)).toBeNull();
    expect(await service.get("x")).toBeNull();
  });

  it("reports ordered, delivered and remaining per line", async () => {
    const quotation = await draft();
    await service.complete(quotation.id);
    const [chairLine, benchLine] = quotation.items;
    await store.deliveryReceiptRepo.insert(
      {
        quotationId: quotation.id,
        number: "DR-1",
        receiptDate: "2026-10-28",
        deliveryAddress: "",
      },
      [
        { quotationItemId: chairLine!.id, quantity: 2 },
        { quotationItemId: benchLine!.id, quantity: 3 },
      ],
    );
    const progress = await service.progress(quotation.id);
    expect(
      progress?.map(({ ordered, delivered, remaining }) => ({
        ordered,
        delivered,
        remaining,
      })),
    ).toEqual([
      { ordered: 2, delivered: 2, remaining: 0 },
      { ordered: 5, delivered: 3, remaining: 2 },
      { ordered: 20, delivered: 0, remaining: 20 },
    ]);
    expect((await service.list())[0]?.deliveryState).toBe("partial");
    expect(await service.progress(UNKNOWN_ID)).toBeNull();
  });
});
