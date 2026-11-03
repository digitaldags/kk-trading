import { documentToday } from "@/lib/domain/documents";
import {
  fieldError,
  type FieldErrors,
  formError,
  fromZodError,
  ok,
  type ServiceResult,
} from "@/lib/domain/result";
import {
  deliveryReceiptInputSchema,
  isId,
  QUOTATION_NOT_FOUND,
  RECEIPT_NOT_FOUND,
  RECEIPT_NUMBER_TAKEN,
  type DeliveryReceiptInput,
  type DeliveryReceiptValues,
} from "@/lib/domain/schemas";
import type {
  DeliveryReceiptWithItems,
  Quotation,
  QuotationWithItems,
} from "@/lib/domain/types";
import type {
  DeliveryReceiptRepo,
  QuotationRepo,
} from "@/lib/repositories/types";
import { lineProgress, type LineProgress } from "./quotationService";

// Delivery receipts (ticket 19). The checks here give friendly errors; the triggers in
// drizzle/0004_documents.sql are the guarantee behind them.

/** A schema field, or `lines.<quotationItemId>` for an error under one line. */
export type ReceiptField = keyof DeliveryReceiptInput | `lines.${string}`;

export const NOT_COMPLETED = "Create receipts from a completed quotation.";
/** Only from a tampered form: the lines of a completed quotation never change. */
export const STALE_LINES = "Reload the page and try again.";

export const leftToDeliver = (remaining: number) =>
  `Only ${remaining} left to deliver.`;

export type ReceiptDefaults = {
  number: string;
  receiptDate: string;
  deliveryAddress: string;
  /** Every line of the quotation, with what is left to deliver as the quantity. */
  lines: (LineProgress & { quantity: number })[];
};

export function createDeliveryReceiptService(deps: {
  quotations: QuotationRepo;
  receipts: DeliveryReceiptRepo;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  async function completedQuotation(
    quotationId: string,
  ): Promise<
    { ok: true; quotation: QuotationWithItems } | { ok: false; error: string }
  > {
    const quotation = isId(quotationId)
      ? await deps.quotations.findById(quotationId)
      : null;
    if (!quotation) return { ok: false, error: QUOTATION_NOT_FOUND };
    if (quotation.status !== "completed") {
      return { ok: false, error: NOT_COMPLETED };
    }
    return { ok: true, quotation };
  }

  /** An error under each line that asks for more than is left. */
  async function overDelivered(
    quotation: QuotationWithItems,
    lines: DeliveryReceiptValues["lines"],
  ): Promise<FieldErrors<ReceiptField>> {
    const progress = lineProgress(
      quotation,
      await deps.receipts.deliveredByLine(quotation.id),
    );
    const errors: FieldErrors<ReceiptField> = {};
    for (const line of lines) {
      const remaining =
        progress.find((p) => p.item.id === line.quotationItemId)?.remaining ??
        0;
      if (line.quantity > remaining) {
        errors[`lines.${line.quotationItemId}`] = leftToDeliver(remaining);
      }
    }
    return errors;
  }

  return {
    /** A quotation's receipts, oldest first, with their items. Empty for an unknown id. */
    async listForQuotation(
      quotationId: string,
    ): Promise<DeliveryReceiptWithItems[]> {
      return isId(quotationId)
        ? deps.receipts.listForQuotation(quotationId)
        : [];
    },

    async newReceiptDefaults(
      quotationId: string,
    ): Promise<ServiceResult<ReceiptDefaults, never>> {
      const found = await completedQuotation(quotationId);
      if (!found.ok) return formError(found.error);
      const { quotation } = found;
      const [delivered, existing] = await Promise.all([
        deps.receipts.deliveredByLine(quotation.id),
        deps.receipts.listForQuotation(quotation.id),
      ]);
      return ok({
        // Receipt numbers are unique, so only the first can reuse the quotation's.
        number: existing.length ? "" : quotation.number,
        receiptDate: documentToday(now()),
        deliveryAddress: quotation.deliveryAddress,
        lines: lineProgress(quotation, delivered).map((p) => ({
          ...p,
          quantity: p.remaining,
        })),
      });
    },

    async create(
      quotationId: string,
      input: DeliveryReceiptInput,
    ): Promise<ServiceResult<DeliveryReceiptWithItems, ReceiptField>> {
      const parsed = deliveryReceiptInputSchema.safeParse(input);
      if (!parsed.success) {
        // A line's error goes under that line, by the quotation item it delivers.
        const ids = Array.isArray(input?.lines)
          ? input.lines.map((l) => l?.quotationItemId)
          : [];
        return fromZodError<ReceiptField>(parsed.error, {
          lineKey: (field, index) => {
            const id = ids[index];
            return field === "lines" && typeof id === "string" && isId(id)
              ? `lines.${id}`
              : undefined;
          },
        });
      }
      const { lines, ...header } = parsed.data;

      const found = await completedQuotation(quotationId);
      if (!found.ok) return formError(found.error);
      const { quotation } = found;

      const lineIds = new Set(quotation.items.map((item) => item.id));
      if (lines.some((line) => !lineIds.has(line.quotationItemId))) {
        return formError(STALE_LINES);
      }
      const over = await overDelivered(quotation, lines);
      if (Object.keys(over).length) return { ok: false, fieldErrors: over };
      if (await deps.receipts.findByNumber(header.number)) {
        return fieldError("number", RECEIPT_NUMBER_TAKEN);
      }

      const result = await deps.receipts.insert(
        { ...header, quotationId: quotation.id },
        lines,
      );
      if (result.ok) return ok(result.data);
      switch (result.reason) {
        case "duplicate_number":
          return fieldError("number", RECEIPT_NUMBER_TAKEN);
        case "not_completed":
          return formError(NOT_COMPLETED);
        case "over_delivery": {
          // Another receipt was saved since the check above: show what's left now.
          const current = await overDelivered(quotation, lines);
          return Object.keys(current).length
            ? { ok: false, fieldErrors: current }
            : formError(STALE_LINES);
        }
      }
    },

    /** Its quantities count as undelivered again. Returns the quotation, to refresh it. */
    async delete(
      receiptId: string,
    ): Promise<ServiceResult<{ quotationId: string }, never>> {
      const receipt = isId(receiptId)
        ? await deps.receipts.findById(receiptId)
        : null;
      if (!receipt || !(await deps.receipts.delete(receiptId))) {
        return formError(RECEIPT_NOT_FOUND);
      }
      return ok({ quotationId: receipt.quotationId });
    },

    /** A receipt and its quotation's header (the customer details), for printing. */
    async get(receiptId: string): Promise<{
      receipt: DeliveryReceiptWithItems;
      quotation: Quotation;
    } | null> {
      const receipt = isId(receiptId)
        ? await deps.receipts.findById(receiptId)
        : null;
      if (!receipt) return null;
      const quotation = await deps.quotations.findById(receipt.quotationId);
      if (!quotation) return null;
      const { items: _items, ...header } = quotation;
      return { receipt, quotation: header };
    },
  };
}

export type DeliveryReceiptService = ReturnType<
  typeof createDeliveryReceiptService
>;
