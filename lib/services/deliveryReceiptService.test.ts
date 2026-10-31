import { beforeEach, describe, expect, it } from "vitest";
import type { DeliveryReceiptInput } from "@/lib/domain/schemas";
import type { QuotationWithItems } from "@/lib/domain/types";
import {
  createDeliveryReceiptService,
  NOT_COMPLETED,
  STALE_LINES,
} from "./deliveryReceiptService";
import { createQuotationService } from "./quotationService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

let store: FakeStore;
let quotations: ReturnType<typeof createQuotationService>;
let service: ReturnType<typeof createDeliveryReceiptService>;
/** Completed: 8 chairs and 2 desks. */
let quotation: QuotationWithItems;
let chairLine: string;
let deskLine: string;

const TAKEN = "Another delivery receipt already uses this number.";
const UNKNOWN_ID = "00000000-0000-4000-8000-999999999999";

beforeEach(async () => {
  store = createFakeStore();
  quotations = createQuotationService({
    quotations: store.quotationRepo,
    receipts: store.deliveryReceiptRepo,
    products: store.productRepo,
  });
  service = createDeliveryReceiptService({
    quotations: store.quotationRepo,
    receipts: store.deliveryReceiptRepo,
    now: store.clock.now,
  });
  const office = await store.addCategory({ name: "Office" });
  const chair = await store.addProduct({
    name: "Chair",
    categoryId: office.id,
  });
  const desk = await store.addProduct({ name: "Desk", categoryId: office.id });
  const created = await quotations.createDraft({
    number: "Q-2026-001",
    quoteDate: "2026-10-27",
    customerName: "Acme Gym",
    deliveryAddress: "Quezon City",
    items: [
      { productId: chair.id, quantity: 8, unitPrice: 100 },
      { productId: desk.id, quantity: 2, unitPrice: 100 },
    ],
  });
  if (!created.ok) throw new Error("Couldn't create the quotation.");
  await quotations.complete(created.data.id);
  quotation = (await quotations.get(created.data.id))!;
  [chairLine, deskLine] = quotation.items.map((i) => i.id) as [string, string];
});

const receipt = (
  lines: { quotationItemId: string; quantity: number | string }[],
  overrides: Partial<DeliveryReceiptInput> = {},
): DeliveryReceiptInput => ({
  number: "DR-1",
  receiptDate: "2026-10-28",
  deliveryAddress: "Quezon City",
  lines,
  ...overrides,
});

describe("deliveryReceiptService.newReceiptDefaults", () => {
  it("starts with today, the delivery address, everything left and the quotation number", async () => {
    store.clock.set(new Date("2026-10-28T01:00:00Z"));
    const result = await service.newReceiptDefaults(quotation.id);
    expect(result.ok && result.data).toMatchObject({
      number: "Q-2026-001",
      receiptDate: "2026-10-28",
      deliveryAddress: "Quezon City",
      lines: [
        { item: { id: chairLine }, remaining: 8, quantity: 8 },
        { item: { id: deskLine }, remaining: 2, quantity: 2 },
      ],
    });
  });

  it("leaves the number empty once a receipt exists, and fills in what's left", async () => {
    await service.create(
      quotation.id,
      receipt([{ quotationItemId: chairLine, quantity: 5 }]),
    );
    const result = await service.newReceiptDefaults(quotation.id);
    expect(result.ok && result.data.number).toBe("");
    expect(result.ok && result.data.lines.map((l) => l.quantity)).toEqual([
      3, 2,
    ]);
  });

  it("needs a completed quotation", async () => {
    const draft = await quotations.createDraft({
      number: "Q-2",
      quoteDate: "2026-10-27",
      customerName: "Beta",
    });
    expect(
      await service.newReceiptDefaults(draft.ok ? draft.data.id : ""),
    ).toMatchObject({ formError: NOT_COMPLETED });
    expect(await service.newReceiptDefaults(UNKNOWN_ID)).toMatchObject({
      formError: "That quotation no longer exists.",
    });
  });
});

describe("deliveryReceiptService.create", () => {
  it("creates a receipt with the lines that have a quantity", async () => {
    const result = await service.create(
      quotation.id,
      receipt([
        { quotationItemId: chairLine, quantity: "5" },
        { quotationItemId: deskLine, quantity: "0" },
      ]),
    );
    expect(result.ok && result.data).toMatchObject({
      quotationId: quotation.id,
      number: "DR-1",
      items: [{ quotationItemId: chairLine, quantity: 5 }],
    });
  });

  it("refuses over-delivery across two receipts, under each line", async () => {
    await service.create(
      quotation.id,
      receipt([{ quotationItemId: chairLine, quantity: 8 }], {
        number: "DR-1",
      }),
    );
    const second = await service.create(
      quotation.id,
      receipt(
        [
          { quotationItemId: chairLine, quantity: 1 },
          { quotationItemId: deskLine, quantity: 3 },
        ],
        { number: "DR-2" },
      ),
    );
    expect(second).toEqual({
      ok: false,
      fieldErrors: {
        [`lines.${chairLine}`]: "Only 0 left to deliver.",
        [`lines.${deskLine}`]: "Only 2 left to deliver.",
      },
    });
    expect(
      await store.deliveryReceiptRepo.listForQuotation(quotation.id),
    ).toHaveLength(1);
  });

  it("maps the database's over-delivery when another receipt won the race", async () => {
    await service.create(
      quotation.id,
      receipt([{ quotationItemId: chairLine, quantity: 6 }]),
    );
    // The check reads before the other receipt landed; the trigger refuses it.
    const real = store.deliveryReceiptRepo.deliveredByLine;
    let calls = 0;
    store.deliveryReceiptRepo.deliveredByLine = async (id) =>
      calls++ === 0 ? new Map() : real(id);
    const result = await service.create(
      quotation.id,
      receipt([{ quotationItemId: chairLine, quantity: 3 }], {
        number: "DR-2",
      }),
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: { [`lines.${chairLine}`]: "Only 2 left to deliver." },
    });
  });

  it("asks to reload when the database refuses and nothing is over any more", async () => {
    store.deliveryReceiptRepo.insert = async () => ({
      ok: false,
      reason: "over_delivery",
    });
    expect(
      await service.create(
        quotation.id,
        receipt([{ quotationItemId: chairLine, quantity: 1 }]),
      ),
    ).toMatchObject({ formError: STALE_LINES });
  });

  it("counts a deleted receipt's quantities as undelivered again", async () => {
    const lines = [{ quotationItemId: chairLine, quantity: 8 }];
    const first = await service.create(quotation.id, receipt(lines));
    if (!first.ok) throw new Error("Couldn't create the receipt.");

    expect(await service.delete(first.data.id)).toEqual({
      ok: true,
      data: { quotationId: quotation.id },
    });
    const again = await service.create(quotation.id, receipt(lines));
    expect(again.ok && again.data).toMatchObject({
      number: "DR-1",
      items: [{ quantity: 8 }],
    });
  });

  it("rejects a receipt number in use, in any case", async () => {
    await service.create(
      quotation.id,
      receipt([{ quotationItemId: chairLine, quantity: 1 }], {
        number: "DR-1",
      }),
    );
    const result = await service.create(
      quotation.id,
      receipt([{ quotationItemId: chairLine, quantity: 1 }], {
        number: "dr-1",
      }),
    );
    expect(result).toEqual({ ok: false, fieldErrors: { number: TAKEN } });
  });

  it("allows the quotation's own number on a receipt", async () => {
    const result = await service.create(
      quotation.id,
      receipt([{ quotationItemId: chairLine, quantity: 1 }], {
        number: "q-2026-001",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("maps the repository's refusals to the same messages", async () => {
    const lines = [{ quotationItemId: chairLine, quantity: 1 }];
    store.deliveryReceiptRepo.insert = async () => ({
      ok: false,
      reason: "duplicate_number",
    });
    expect(await service.create(quotation.id, receipt(lines))).toEqual({
      ok: false,
      fieldErrors: { number: TAKEN },
    });
    store.deliveryReceiptRepo.insert = async () => ({
      ok: false,
      reason: "not_completed",
    });
    expect(await service.create(quotation.id, receipt(lines))).toMatchObject({
      formError: NOT_COMPLETED,
    });
  });

  it("needs a completed quotation", async () => {
    const draft = await quotations.createDraft({
      number: "Q-2",
      quoteDate: "2026-10-27",
      customerName: "Beta",
    });
    const lines = [{ quotationItemId: chairLine, quantity: 1 }];
    expect(
      await service.create(draft.ok ? draft.data.id : "", receipt(lines)),
    ).toMatchObject({ formError: NOT_COMPLETED });
    expect(await service.create("bad", receipt(lines))).toMatchObject({
      formError: "That quotation no longer exists.",
    });
  });

  it("refuses a line from another quotation", async () => {
    expect(
      await service.create(
        quotation.id,
        receipt([{ quotationItemId: UNKNOWN_ID, quantity: 1 }]),
      ),
    ).toMatchObject({ formError: STALE_LINES });
  });

  it("puts input errors under their line", async () => {
    const result = await service.create(
      quotation.id,
      receipt(
        [
          { quotationItemId: chairLine, quantity: "-1" },
          { quotationItemId: deskLine, quantity: 1 },
        ],
        { number: "" },
      ),
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        number: "Enter the receipt number.",
        [`lines.${chairLine}`]: "Enter a whole number of 0 or more.",
      },
    });
  });

  it("asks for at least one quantity", async () => {
    expect(
      await service.create(
        quotation.id,
        receipt([
          { quotationItemId: chairLine, quantity: 0 },
          { quotationItemId: deskLine, quantity: 0 },
        ]),
      ),
    ).toEqual({
      ok: false,
      fieldErrors: { lines: "Enter a quantity for at least one item." },
    });
  });

  it("keeps a malformed line's error on the list", async () => {
    expect(
      await service.create(
        quotation.id,
        receipt([{ quotationItemId: "nope", quantity: 1 }]),
      ),
    ).toEqual({
      ok: false,
      fieldErrors: { lines: "Enter a quantity for at least one item." },
    });
  });
});

describe("deliveryReceiptService.delete and get", () => {
  it("gets a receipt with its lines and the quotation's header, for printing", async () => {
    const created = await service.create(
      quotation.id,
      receipt([{ quotationItemId: deskLine, quantity: 2 }]),
    );
    const found = await service.get(created.ok ? created.data.id : "");
    expect(found?.receipt.items).toEqual([
      expect.objectContaining({
        quantity: 2,
        line: expect.objectContaining({ name: "Desk" }),
      }),
    ]);
    expect(found?.quotation).toMatchObject({ customerName: "Acme Gym" });
    expect(found?.quotation).not.toHaveProperty("items");
  });

  it("returns null or not found for unknown receipts", async () => {
    expect(await service.get(UNKNOWN_ID)).toBeNull();
    expect(await service.get("x")).toBeNull();
    expect(await service.delete(UNKNOWN_ID)).toMatchObject({
      formError: "That delivery receipt no longer exists.",
    });
  });

  it("returns null when the quotation is gone", async () => {
    const created = await service.create(
      quotation.id,
      receipt([{ quotationItemId: deskLine, quantity: 1 }]),
    );
    store.quotationRepo.findById = async () => null;
    expect(await service.get(created.ok ? created.data.id : "")).toBeNull();
  });
});
