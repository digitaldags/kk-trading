import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/domain/types";
import { createDeliveryReceiptService } from "@/lib/services/deliveryReceiptService";
import { createQuotationService } from "@/lib/services/quotationService";
import { createFakeStore, type FakeStore } from "@/lib/services/testing/fakes";

// The quotation and delivery receipt actions (tickets 21 and 22), called directly the way a forged request would,
// against the real service rules on the in-memory fakes.

const requireAdmin = vi.fn();
vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: () => requireAdmin(),
}));

let store: FakeStore;
let service: ReturnType<typeof createQuotationService>;
let receiptService: ReturnType<typeof createDeliveryReceiptService>;
vi.mock("@/lib/services", () => ({
  get quotationService() {
    return service;
  },
  get deliveryReceiptService() {
    return receiptService;
  },
}));

// What `unauthorized()` throws: Next's interrupts carry a digest.
class UnauthorizedInterrupt extends Error {
  digest = "NEXT_HTTP_ERROR_FALLBACK;401";
}

const {
  completeQuotation,
  createDeliveryReceipt,
  declineQuotation,
  deleteDeliveryReceipt,
  deleteQuotation,
  saveQuotation,
} = await import("./actions");

let chair: Product;

const input = (overrides = {}) => ({
  number: "Q-2026-001",
  quoteDate: "2026-10-27",
  customerName: "Acme Gym",
  items: [{ productId: chair.id, quantity: 2, unitPrice: "8,450" }],
  ...overrides,
});

async function saved(overrides = {}) {
  const result = await saveQuotation(input(overrides));
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result;
}

beforeEach(async () => {
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue({ id: "admin", email: "admin" });
  store = createFakeStore();
  service = createQuotationService({
    quotations: store.quotationRepo,
    receipts: store.deliveryReceiptRepo,
    products: store.productRepo,
  });
  receiptService = createDeliveryReceiptService({
    quotations: store.quotationRepo,
    receipts: store.deliveryReceiptRepo,
  });
  const office = await store.addCategory({ name: "Office" });
  chair = await store.addProduct({
    name: "Mesh office chair",
    categoryId: office.id,
    priceCentavos: 274500,
  });
});

describe("saveQuotation", () => {
  it("creates a draft, then saves it again by id", async () => {
    const first = await saved();
    expect(first).toMatchObject({
      message: "Saved quotation Q-2026-001.",
      number: "Q-2026-001",
    });
    expect(Date.parse(first.updatedAt)).not.toBeNaN();

    const second = await saveQuotation({
      ...input({ customerName: "Beta Fitness" }),
      id: first.id,
    });
    expect(second.ok).toBe(true);
    expect((await service.get(first.id))?.customerName).toBe("Beta Fitness");
  });

  it("refuses a number another quotation has in another case, and writes nothing", async () => {
    await saved();
    const result = await saveQuotation(input({ number: "q-2026-001" }));
    expect(result).toEqual({
      ok: false,
      fieldErrors: { number: "Another quotation already uses this number." },
      formError: undefined,
    });
    expect(await service.list()).toHaveLength(1);
  });

  it.each(["complete", "decline"] as const)(
    "won't edit a quotation after %s",
    async (step) => {
      const { id } = await saved();
      await (step === "complete"
        ? completeQuotation(id)
        : declineQuotation(id));
      const result = await saveQuotation({
        ...input({ customerName: "Changed", items: [] }),
        id,
      });
      expect(result).toEqual({
        ok: false,
        fieldErrors: {},
        formError: "Completed and declined quotations can't be edited.",
      });
      const stored = await service.get(id);
      expect(stored?.customerName).toBe("Acme Gym");
      expect(stored?.items).toHaveLength(1);
    },
  );

  it("doesn't change the catalog price when the unit price is edited", async () => {
    await saved({
      items: [{ productId: chair.id, quantity: 1, unitPrice: "1,000" }],
    });
    expect((await store.productRepo.findById(chair.id))?.priceCentavos).toBe(
      274500,
    );
  });
});

describe("completeQuotation, declineQuotation and deleteQuotation", () => {
  it("completes a draft once", async () => {
    const { id } = await saved();
    expect(await completeQuotation(id)).toEqual({
      ok: true,
      message: "Marked Q-2026-001 as completed.",
    });
    expect(await declineQuotation(id)).toEqual({
      ok: false,
      message: "This quotation was already completed or declined.",
    });
  });

  it("won't complete an empty draft", async () => {
    const { id } = await saved({ items: [] });
    expect(await completeQuotation(id)).toEqual({
      ok: false,
      message: "Add at least one product before completing.",
    });
  });

  it("declines a draft", async () => {
    const { id } = await saved();
    expect(await declineQuotation(id)).toEqual({
      ok: true,
      message: "Marked Q-2026-001 as declined.",
    });
  });

  it("deletes drafts only", async () => {
    const draft = await saved({ number: "Q-1" });
    expect(await deleteQuotation(draft.id)).toEqual({
      ok: true,
      message: "Deleted quotation Q-1.",
    });
    expect(await service.get(draft.id)).toBeNull();

    const completed = await saved({ number: "Q-2" });
    await completeQuotation(completed.id);
    expect(await deleteQuotation(completed.id)).toEqual({
      ok: false,
      message: "Only drafts can be deleted.",
    });
    expect(await deleteQuotation("not-an-id")).toEqual({
      ok: false,
      message: "That quotation no longer exists.",
    });
  });
});

describe("without a session", () => {
  it("stops every action before the service runs", async () => {
    const { id } = await saved();
    requireAdmin.mockRejectedValue(new UnauthorizedInterrupt());
    await expect(saveQuotation({ ...input(), id })).rejects.toThrow(
      UnauthorizedInterrupt,
    );
    await expect(completeQuotation(id)).rejects.toThrow(UnauthorizedInterrupt);
    await expect(declineQuotation(id)).rejects.toThrow(UnauthorizedInterrupt);
    await expect(deleteQuotation(id)).rejects.toThrow(UnauthorizedInterrupt);
    expect((await service.get(id))?.status).toBe("draft");
  });

  it("stops the receipt actions before the service runs", async () => {
    const { id, line } = await completed();
    requireAdmin.mockRejectedValue(new UnauthorizedInterrupt());
    await expect(createDeliveryReceipt(id, receipt(line, 1))).rejects.toThrow(
      UnauthorizedInterrupt,
    );
    await expect(deleteDeliveryReceipt(id)).rejects.toThrow(
      UnauthorizedInterrupt,
    );
    expect(await receiptService.listForQuotation(id)).toEqual([]);
  });
});

/** A completed quotation for 20 chairs. */
async function completed() {
  const { id } = await saved({
    items: [{ productId: chair.id, quantity: 20, unitPrice: "2,745" }],
  });
  await completeQuotation(id);
  const line = (await service.get(id))!.items[0]!.id;
  return { id, line };
}

const receipt = (line: string, quantity: number | string, number = "DR-1") => ({
  number,
  receiptDate: "2026-10-28",
  deliveryAddress: "Quezon City",
  lines: [{ quotationItemId: line, quantity }],
});

describe("createDeliveryReceipt and deleteDeliveryReceipt", () => {
  it("creates a receipt, then refuses more than is left", async () => {
    const { id, line } = await completed();
    expect(await createDeliveryReceipt(id, receipt(line, 12))).toMatchObject({
      ok: true,
      message: "Receipt DR-1 created.",
      number: "DR-1",
    });

    // Past the form's max: the service refuses it, whatever the browser sent.
    expect(await createDeliveryReceipt(id, receipt(line, "9", "DR-2"))).toEqual(
      {
        ok: false,
        fieldErrors: { [`lines.${line}`]: "Only 8 left to deliver." },
        formError: undefined,
      },
    );
    expect(
      await createDeliveryReceipt(id, receipt(line, 8, "DR-2")),
    ).toMatchObject({ ok: true });
    expect((await service.progress(id))?.[0]?.remaining).toBe(0);
  });

  it("refuses a number another receipt has, ignoring case", async () => {
    const { id, line } = await completed();
    await createDeliveryReceipt(id, receipt(line, 2));
    expect(await createDeliveryReceipt(id, receipt(line, 2, "dr-1"))).toEqual({
      ok: false,
      fieldErrors: {
        number: "Another delivery receipt already uses this number.",
      },
      formError: undefined,
    });
  });

  it("refuses a receipt for a draft", async () => {
    const draft = await saved();
    const line = (await service.get(draft.id))!.items[0]!.id;
    expect(await createDeliveryReceipt(draft.id, receipt(line, 1))).toEqual({
      ok: false,
      fieldErrors: {},
      formError: "Create receipts from a completed quotation.",
    });
  });

  it("deletes a receipt, which puts its quantities back", async () => {
    const { id, line } = await completed();
    const created = await createDeliveryReceipt(id, receipt(line, 20));
    if (!created.ok) throw new Error(JSON.stringify(created));
    expect((await service.progress(id))?.[0]?.remaining).toBe(0);

    expect(await deleteDeliveryReceipt(created.id)).toEqual({
      ok: true,
      message: "Deleted receipt DR-1.",
    });
    expect((await service.progress(id))?.[0]?.remaining).toBe(20);
    expect(await deleteDeliveryReceipt(created.id)).toEqual({
      ok: false,
      message: "That delivery receipt no longer exists.",
    });
  });
});
