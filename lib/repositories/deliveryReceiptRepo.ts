import { asc, eq, inArray, sql, sum } from "drizzle-orm";
import { atomic } from "@/lib/db/atomic";
import type { Db } from "@/lib/db/client";
import {
  deliveryReceiptItems,
  deliveryReceipts,
  quotationItems,
} from "@/lib/db/schema";
import type {
  DeliveryReceipt,
  DeliveryReceiptWithItems,
} from "@/lib/domain/types";
import { isRaisedCheck, isUniqueViolation } from "./pgError";
import type { DeliveryReceiptRepo } from "./types";

// Delivery receipts (ticket 18). The rules that need a lock (no over-delivery, only for a
// completed quotation) are triggers in drizzle/0004_documents.sql; this maps their errors.

const NUMBER_INDEX = "delivery_receipts_number_lower_idx";

export function createDeliveryReceiptRepo(db: Db): DeliveryReceiptRepo {
  /** The receipts with their items, each joined to the quotation line it prints. */
  async function withItems(
    receipts: DeliveryReceipt[],
  ): Promise<DeliveryReceiptWithItems[]> {
    if (!receipts.length) return [];
    const rows = await db
      .select({ item: deliveryReceiptItems, line: quotationItems })
      .from(deliveryReceiptItems)
      .innerJoin(
        quotationItems,
        eq(deliveryReceiptItems.quotationItemId, quotationItems.id),
      )
      .where(
        inArray(
          deliveryReceiptItems.receiptId,
          receipts.map((r) => r.id),
        ),
      )
      .orderBy(asc(quotationItems.position));
    return receipts.map((receipt) => ({
      ...receipt,
      items: rows
        .filter((r) => r.item.receiptId === receipt.id)
        .map((r) => ({
          id: r.item.id,
          quotationItemId: r.item.quotationItemId,
          quantity: r.item.quantity,
          line: r.line,
        })),
    }));
  }

  async function findById(id: string) {
    const [receipt] = await db
      .select()
      .from(deliveryReceipts)
      .where(eq(deliveryReceipts.id, id));
    if (!receipt) return null;
    const [full] = await withItems([receipt]);
    return full ?? null;
  }

  return {
    async listForQuotation(quotationId) {
      const receipts = await db
        .select()
        .from(deliveryReceipts)
        .where(eq(deliveryReceipts.quotationId, quotationId))
        .orderBy(asc(deliveryReceipts.createdAt), asc(deliveryReceipts.id));
      return withItems(receipts);
    },

    async deliveredByLine(quotationId) {
      const rows = await db
        .select({
          lineId: deliveryReceiptItems.quotationItemId,
          delivered: sum(deliveryReceiptItems.quantity).mapWith(Number),
        })
        .from(deliveryReceiptItems)
        .innerJoin(
          quotationItems,
          eq(deliveryReceiptItems.quotationItemId, quotationItems.id),
        )
        .where(eq(quotationItems.quotationId, quotationId))
        .groupBy(deliveryReceiptItems.quotationItemId);
      return new Map(rows.map((r) => [r.lineId, r.delivered]));
    },

    findById,

    async findByNumber(number) {
      const [row] = await db
        .select()
        .from(deliveryReceipts)
        .where(sql`lower(${deliveryReceipts.number}) = lower(${number})`)
        .limit(1);
      return row ?? null;
    },

    // One batch, so a refused line rolls back the whole receipt. The id is made here, so
    // the items can reference it in the same batch.
    async insert(header, items) {
      const id = crypto.randomUUID();
      try {
        await atomic(db, (q) => [
          q.insert(deliveryReceipts).values({ ...header, id }),
          ...(items.length
            ? [
                q
                  .insert(deliveryReceiptItems)
                  .values(items.map((item) => ({ ...item, receiptId: id }))),
              ]
            : []),
        ]);
      } catch (error) {
        if (isUniqueViolation(error, NUMBER_INDEX)) {
          return { ok: false, reason: "duplicate_number" };
        }
        if (isRaisedCheck(error, "over_delivery")) {
          return { ok: false, reason: "over_delivery" };
        }
        if (isRaisedCheck(error, "quotation_not_completed")) {
          return { ok: false, reason: "not_completed" };
        }
        throw error;
      }
      const saved = await findById(id);
      if (!saved) throw new Error("Delivery receipt insert returned no row.");
      return { ok: true, data: saved };
    },

    async delete(id) {
      const rows = await db
        .delete(deliveryReceipts)
        .where(eq(deliveryReceipts.id, id))
        .returning({ id: deliveryReceipts.id });
      return rows.length > 0;
    },
  };
}
