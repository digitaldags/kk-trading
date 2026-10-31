import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/domain/types";
import { createQuotationService } from "@/lib/services/quotationService";
import { createFakeStore, type FakeStore } from "@/lib/services/testing/fakes";

// The quotation actions (ticket 21), called directly the way a forged request would,
// against the real service rules on the in-memory fakes.

const requireAdmin = vi.fn();
vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: () => requireAdmin(),
}));

let store: FakeStore;
let service: ReturnType<typeof createQuotationService>;
vi.mock("@/lib/services", () => ({
  get quotationService() {
    return service;
  },
}));

// What `unauthorized()` throws: Next's interrupts carry a digest.
class UnauthorizedInterrupt extends Error {
  digest = "NEXT_HTTP_ERROR_FALLBACK;401";
}

const { completeQuotation, declineQuotation, deleteQuotation, saveQuotation } =
  await import("./actions");

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
});
