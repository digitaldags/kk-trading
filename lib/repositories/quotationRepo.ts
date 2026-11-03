import { asc, eq, and, sql, type SQL } from "drizzle-orm";
import { atomic } from "@/lib/db/atomic";
import type { Db } from "@/lib/db/client";
import { queryRows } from "@/lib/db/publish";
import { quotationItems, quotations } from "@/lib/db/schema";
import type { DeliveryState, QuotationStatus } from "@/lib/domain/documents";
import type { QuotationSummary } from "@/lib/domain/types";
import { escapeLike } from "./like";
import { isUniqueViolation } from "./pgError";
import type { NewQuotationItem, QuotationRepo } from "./types";

// Quotations (ticket 18). Admin-only, outside draft and publish.

const NUMBER_INDEX = "quotations_number_lower_idx";

/** A `list()` row as Postgres returns it. Money comes back as text: it's a bigint. */
type SummaryRow = {
  id: string;
  number: string;
  status: QuotationStatus;
  quote_date: string;
  customer_name: string;
  updated_at: string | Date;
  item_count: number;
  grand_total: string;
  delivery_state: DeliveryState;
};

export function createQuotationRepo(db: Db): QuotationRepo {
  const itemValues = (quotationId: string, items: NewQuotationItem[]) =>
    items.map((item, position) => ({ ...item, quotationId, position }));

  async function findById(id: string) {
    const [header] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, id));
    if (!header) return null;
    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, id))
      .orderBy(asc(quotationItems.position));
    return { ...header, items };
  }

  return {
    // One query: the totals and the delivery state come from lateral subqueries, so
    // the list never loads the lines. Money is summed as bigint, since quantity × unit
    // price can pass int4, and converted with Number() (exact up to 2^53 centavos).
    async list({ status, q } = {}) {
      const conditions: SQL[] = [];
      if (status) conditions.push(sql`q.status = ${status}`);
      if (q) {
        const pattern = `%${escapeLike(q)}%`;
        conditions.push(
          sql`(q.number ilike ${pattern} or q.customer_name ilike ${pattern})`,
        );
      }
      const where = conditions.length
        ? sql`where ${sql.join(conditions, sql` and `)}`
        : sql``;

      const rows = await queryRows<SummaryRow>(
        db,
        sql`
          select q.id, q.number, q.status, q.quote_date::text as quote_date,
            q.customer_name, q.updated_at,
            totals.item_count, totals.grand_total::text as grand_total,
            case
              when delivery.delivered = 0 then 'none'
              when delivery.delivered >= delivery.ordered then 'full'
              else 'partial'
            end as delivery_state
          from quotations q
          cross join lateral (
            select count(*)::int as item_count,
              coalesce(sum(qi.quantity::bigint * qi.unit_price_centavos), 0) as grand_total
            from quotation_items qi
            where qi.quotation_id = q.id
          ) totals
          cross join lateral (
            select coalesce(sum(qi.quantity), 0) as ordered,
              coalesce(sum(least(coalesce(done.quantity, 0), qi.quantity)), 0) as delivered
            from quotation_items qi
            left join (
              select dri.quotation_item_id, sum(dri.quantity) as quantity
              from delivery_receipt_items dri
              group by dri.quotation_item_id
            ) done on done.quotation_item_id = qi.id
            where qi.quotation_id = q.id
          ) delivery
          ${where}
          order by q.quote_date desc, q.created_at desc, q.id
        `,
      );
      return rows.map((r): QuotationSummary => ({
        id: r.id,
        number: r.number,
        status: r.status,
        quoteDate: r.quote_date,
        customerName: r.customer_name,
        updatedAt: new Date(r.updated_at),
        itemCount: r.item_count,
        grandTotalCentavos: Number(r.grand_total),
        deliveryState: r.delivery_state,
      }));
    },

    findById,

    async findByNumber(number) {
      const [row] = await db
        .select()
        .from(quotations)
        .where(sql`lower(${quotations.number}) = lower(${number})`)
        .limit(1);
      return row ?? null;
    },

    // The id is made here, so the lines can reference it in the same batch.
    async insert(header, items) {
      const id = crypto.randomUUID();
      try {
        await atomic(db, (q) => [
          q.insert(quotations).values({ ...header, id }),
          ...(items.length
            ? [q.insert(quotationItems).values(itemValues(id, items))]
            : []),
        ]);
      } catch (error) {
        if (isUniqueViolation(error, NUMBER_INDEX)) {
          return { ok: false, reason: "duplicate_number" };
        }
        throw error;
      }
      const saved = await findById(id);
      if (!saved) throw new Error("Quotation insert returned no row.");
      return { ok: true, data: saved };
    },

    async replace(id, header, items) {
      const [existing] = await db
        .select({ id: quotations.id })
        .from(quotations)
        .where(eq(quotations.id, id));
      if (!existing) return { ok: true, data: null };
      try {
        await atomic(db, (q) => [
          q
            .update(quotations)
            .set({ ...header, updatedAt: new Date() })
            .where(eq(quotations.id, id)),
          q.delete(quotationItems).where(eq(quotationItems.quotationId, id)),
          ...(items.length
            ? [q.insert(quotationItems).values(itemValues(id, items))]
            : []),
        ]);
      } catch (error) {
        if (isUniqueViolation(error, NUMBER_INDEX)) {
          return { ok: false, reason: "duplicate_number" };
        }
        throw error;
      }
      return { ok: true, data: await findById(id) };
    },

    // Only moves from the status the caller saw, so two admins can't both complete (or
    // decline) the same quotation. Back to draft clears both stamps.
    async setStatus(id, from, to) {
      const stamps =
        to === "completed"
          ? { completedAt: sql`now()`, declinedAt: null }
          : to === "declined"
            ? { declinedAt: sql`now()`, completedAt: null }
            : { completedAt: null, declinedAt: null };
      const [row] = await db
        .update(quotations)
        .set({ status: to, ...stamps, updatedAt: new Date() })
        .where(and(eq(quotations.id, id), eq(quotations.status, from)))
        .returning();
      return row ?? null;
    },

    async delete(id) {
      const rows = await db
        .delete(quotations)
        .where(eq(quotations.id, id))
        .returning({ id: quotations.id });
      return rows.length > 0;
    },
  };
}
