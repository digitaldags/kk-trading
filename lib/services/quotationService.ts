import {
  documentToday,
  QUOTATION_DEFAULTS,
  QUOTATION_STATUSES,
  type QuotationStatus,
} from "@/lib/domain/documents";
import {
  fieldError,
  formError,
  fromZodError,
  ok,
  type ServiceResult,
} from "@/lib/domain/result";
import {
  isId,
  MAX_SEARCH_LENGTH,
  QUOTATION_NOT_FOUND,
  QUOTATION_NUMBER_TAKEN,
  quotationInputSchema,
  type QuotationInput,
  type QuotationValues,
} from "@/lib/domain/schemas";
import type {
  Quotation,
  QuotationItem,
  QuotationSummary,
  QuotationWithItems,
} from "@/lib/domain/types";
import type {
  DeliveryReceiptRepo,
  NewQuotation,
  NewQuotationItem,
  ProductRepo,
  QuotationRepo,
} from "@/lib/repositories/types";

// Quotations (ticket 19). Only drafts change; completed and declined ones are locked.

/** A schema field, or `items.<index>` for an error under one line of the editor. */
export type QuotationField = keyof QuotationInput | `items.${number}`;

export const LOCKED = "Completed and declined quotations can't be edited.";
export const PRODUCT_GONE =
  "One of the products no longer exists. Remove it and add it again.";
export const NO_ITEMS = "Add at least one product before completing.";
export const ALREADY_DECIDED =
  "This quotation was already completed or declined.";
export const ONLY_DRAFTS_DELETED = "Only drafts can be deleted.";

/** What a new quotation's form starts with. */
export type QuotationDraftDefaults = Omit<NewQuotation, "status"> & {
  items: [];
};

/** One line of a quotation, with how much its receipts delivered. */
export type LineProgress = {
  item: QuotationItem;
  ordered: number;
  delivered: number;
  remaining: number;
};

const lineKey = (field: string, index: number) =>
  field === "items" ? (`items.${index}` as const) : undefined;

export function createQuotationService(deps: {
  quotations: QuotationRepo;
  receipts: DeliveryReceiptRepo;
  products: ProductRepo;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  async function numberTaken(number: string, exceptId?: string) {
    const other = await deps.quotations.findByNumber(number);
    return other !== null && other.id !== exceptId;
  }

  /**
   * The lines to write. A product already on the quotation keeps its stored copy (code,
   * name, specs, unit, photo) and only takes the new quantity and price, so catalog edits
   * never rewrite a quotation. A new one is copied from the live tables: the admin's
   * current catalog, not the published store.
   */
  async function buildItems(
    items: QuotationValues["items"],
    existing: QuotationItem[],
  ): Promise<
    { ok: true; items: NewQuotationItem[] } | { ok: false; index: number }
  > {
    const built: NewQuotationItem[] = [];
    for (const [index, item] of items.entries()) {
      const kept = existing.find((line) => line.productId === item.productId);
      const source = kept ?? (await deps.products.findById(item.productId));
      if (!source) return { ok: false, index };
      built.push({
        productId: item.productId,
        code: source.code,
        name: source.name,
        specs: source.specs,
        uom: source.uom,
        imageUrl: source.imageUrl,
        unitPriceCentavos: item.unitPrice,
        quantity: item.quantity,
      });
    }
    return { ok: true, items: built };
  }

  async function save(
    input: QuotationInput,
    existing: QuotationWithItems | null,
  ): Promise<ServiceResult<QuotationWithItems, QuotationField>> {
    const parsed = quotationInputSchema.safeParse(input);
    if (!parsed.success) return fromZodError(parsed.error, { lineKey });
    const { items, ...header } = parsed.data;

    if (await numberTaken(header.number, existing?.id)) {
      return fieldError("number", QUOTATION_NUMBER_TAKEN);
    }
    const built = await buildItems(items, existing?.items ?? []);
    if (!built.ok) return fieldError(`items.${built.index}`, PRODUCT_GONE);

    const values: NewQuotation = { ...header, status: "draft" };
    const result = existing
      ? await deps.quotations.replace(existing.id, values, built.items)
      : await deps.quotations.insert(values, built.items);
    if (!result.ok) return fieldError("number", QUOTATION_NUMBER_TAKEN);
    if (!result.data) return formError(QUOTATION_NOT_FOUND);
    return ok(result.data);
  }

  /** Moves a draft to `to`. Only from draft, and only once. */
  async function decide(
    id: string,
    to: Exclude<QuotationStatus, "draft">,
  ): Promise<ServiceResult<Quotation, never>> {
    const existing = isId(id) ? await deps.quotations.findById(id) : null;
    if (!existing) return formError(QUOTATION_NOT_FOUND);
    if (existing.status !== "draft") return formError(ALREADY_DECIDED);
    if (to === "completed" && !existing.items.length) {
      return formError(NO_ITEMS);
    }
    const updated = await deps.quotations.setStatus(id, "draft", to);
    if (!updated) return formError(ALREADY_DECIDED);
    return ok(updated);
  }

  return {
    /** The documents list. Bad filters from the URL are dropped. */
    async list({ status, q }: { status?: string; q?: string } = {}): Promise<
      QuotationSummary[]
    > {
      const known = QUOTATION_STATUSES.find((s) => s === status);
      const needle = (q ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
      return deps.quotations.list({
        ...(known ? { status: known } : {}),
        ...(needle ? { q: needle } : {}),
      });
    },

    /** Null when the id is unknown or malformed. */
    async get(id: string): Promise<QuotationWithItems | null> {
      return isId(id) ? deps.quotations.findById(id) : null;
    },

    newDraftDefaults(): QuotationDraftDefaults {
      return {
        number: "",
        quoteDate: documentToday(now()),
        customerName: "",
        customerAddress: "",
        customerTin: "",
        deliveryAddress: "",
        ...QUOTATION_DEFAULTS,
        items: [],
      };
    },

    async createDraft(
      input: QuotationInput,
    ): Promise<ServiceResult<QuotationWithItems, QuotationField>> {
      return save(input, null);
    },

    async updateDraft(
      id: string,
      input: QuotationInput,
    ): Promise<ServiceResult<QuotationWithItems, QuotationField>> {
      const existing = isId(id) ? await deps.quotations.findById(id) : null;
      if (!existing) return formError(QUOTATION_NOT_FOUND);
      if (existing.status !== "draft") return formError(LOCKED);
      return save(input, existing);
    },

    async complete(id: string): Promise<ServiceResult<Quotation, never>> {
      return decide(id, "completed");
    },

    async decline(id: string): Promise<ServiceResult<Quotation, never>> {
      return decide(id, "declined");
    },

    async deleteDraft(
      id: string,
    ): Promise<ServiceResult<{ id: string }, never>> {
      const existing = isId(id) ? await deps.quotations.findById(id) : null;
      if (!existing) return formError(QUOTATION_NOT_FOUND);
      if (existing.status !== "draft") return formError(ONLY_DRAFTS_DELETED);
      if (!(await deps.quotations.delete(id))) {
        return formError(QUOTATION_NOT_FOUND);
      }
      return ok({ id });
    },

    /** Ordered, delivered and remaining per line. Null when the id is unknown. */
    async progress(id: string): Promise<LineProgress[] | null> {
      const quotation = isId(id) ? await deps.quotations.findById(id) : null;
      if (!quotation) return null;
      return lineProgress(quotation, await deps.receipts.deliveredByLine(id));
    },
  };
}

/** Each line's delivered and remaining quantities, from `deliveredByLine`. */
export function lineProgress(
  quotation: QuotationWithItems,
  delivered: Map<string, number>,
): LineProgress[] {
  return quotation.items.map((item) => {
    const done = delivered.get(item.id) ?? 0;
    return {
      item,
      ordered: item.quantity,
      delivered: done,
      remaining: Math.max(0, item.quantity - done),
    };
  });
}

export type QuotationService = ReturnType<typeof createQuotationService>;
