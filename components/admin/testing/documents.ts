import { QUOTATION_DEFAULTS } from "@/lib/domain/documents";
import type {
  DeliveryReceiptWithItems,
  QuotationItem,
  QuotationWithItems,
} from "@/lib/domain/types";
import type { Uom } from "@/lib/domain/uom";
import type { ReceiptDefaults } from "@/lib/services/deliveryReceiptService";

// A completed quotation shaped like the sample: 2 cabinets, 5 tables and 20 chairs.

export const QUOTATION_ID = "00000000-0000-4000-8000-0000000000d1";

const at = new Date("2026-10-27T07:42:00Z");

function item(
  n: number,
  code: string,
  name: string,
  quantity: number,
  uom: Uom = "pcs",
): QuotationItem {
  return {
    id: `00000000-0000-4000-8000-0000000000e${n}`,
    quotationId: QUOTATION_ID,
    position: n - 1,
    productId: `00000000-0000-4000-8000-0000000000c${n}`,
    code,
    name,
    specs: "",
    uom,
    imageUrl: null,
    unitPriceCentavos: 100000,
    quantity,
  };
}

export const CABINET_LINE = item(1, "KK-DG-D4", "4-drawer filing cabinet", 2);
export const TABLE_LINE = item(2, "KK-GF-Z014", "Office table, white", 5);
export const CHAIR_LINE = item(3, "KK-YS 948", "Mesh office chair", 20);

export function completedQuotation(
  overrides: Partial<QuotationWithItems> = {},
): QuotationWithItems {
  return {
    id: QUOTATION_ID,
    number: "2026-1027-NORTHWIND",
    status: "completed",
    quoteDate: "2026-10-27",
    customerName: "Northwind",
    customerAddress: "Makati City",
    customerTin: "123-456-789",
    deliveryAddress: "Quezon City",
    ...QUOTATION_DEFAULTS,
    completedAt: new Date("2026-10-28T02:00:00Z"),
    declinedAt: null,
    createdAt: at,
    updatedAt: at,
    items: [CABINET_LINE, TABLE_LINE, CHAIR_LINE],
    ...overrides,
  };
}

/** Receipt defaults with `delivered` per line (by line index), as the service builds them. */
export function receiptDefaults(
  delivered: number[] = [],
  overrides: Partial<Omit<ReceiptDefaults, "lines">> = {},
  items: QuotationItem[] = [CABINET_LINE, TABLE_LINE, CHAIR_LINE],
): ReceiptDefaults {
  return {
    number: "2026-1027-NORTHWIND",
    receiptDate: "2026-10-28",
    deliveryAddress: "Quezon City",
    ...overrides,
    lines: items.map((line, index) => {
      const done = delivered[index] ?? 0;
      const remaining = Math.max(0, line.quantity - done);
      return {
        item: line,
        ordered: line.quantity,
        delivered: done,
        remaining,
        quantity: remaining,
      };
    }),
  };
}

export function receipt(
  n: number,
  number: string,
  lines: [QuotationItem, number][],
): DeliveryReceiptWithItems {
  const id = `00000000-0000-4000-8000-0000000000f${n}`;
  return {
    id,
    quotationId: QUOTATION_ID,
    number,
    receiptDate: "2026-10-28",
    deliveryAddress: "Quezon City",
    createdAt: at,
    items: lines.map(([line, quantity], index) => ({
      id: `${id.slice(0, -2)}${n}${index}`,
      quotationItemId: line.id,
      quantity,
      line,
    })),
  };
}
