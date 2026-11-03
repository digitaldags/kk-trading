// Quotations and delivery receipts (tickets 18–24). Admin-only records: never part of
// draft and publish. The database check constraint `quotations_status_check` is built
// from QUOTATION_STATUSES.

import type { Uom } from "./uom";

export const QUOTATION_STATUSES = ["draft", "completed", "declined"] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  completed: "Completed",
  declined: "Declined",
};

/** How much of a quotation's lines its delivery receipts cover. */
export const DELIVERY_STATES = ["none", "partial", "full"] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const DELIVERY_STATE_LABELS: Record<DeliveryState, string> = {
  none: "Not delivered",
  partial: "Partly delivered",
  full: "Fully delivered",
};

/** Only completed quotations are delivered; drafts and declined ones show a dash. */
export function deliveryStateLabel(
  status: QuotationStatus,
  state: DeliveryState,
): string {
  return status === "completed" ? DELIVERY_STATE_LABELS[state] : "—";
}

/** The same rule as `delivery_state` in `quotationRepo.list`. */
export function deliveryState(
  ordered: number,
  delivered: number,
): DeliveryState {
  if (delivered <= 0) return "none";
  return delivered >= ordered ? "full" : "partial";
}

function safe(centavos: number): number {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError("Total is too large to compute exactly.");
  }
  return centavos;
}

/** Quantity × unit price, in centavos. */
export function lineTotal(item: {
  quantity: number;
  unitPriceCentavos: number;
}): number {
  return safe(item.quantity * item.unitPriceCentavos);
}

/** The sum of the line totals, in centavos. */
export function grandTotal(
  items: { quantity: number; unitPriceCentavos: number }[],
): number {
  return items.reduce((sum, item) => safe(sum + lineTotal(item)), 0);
}

/**
 * Text pre-filled on a new quotation: the sample quotation's wording with its typos
 * fixed. Editable per quotation; changing it affects new quotations only.
 */
export const QUOTATION_DEFAULTS = {
  deliveryTerm: "ARRANGED BY BUYER",
  paymentTerms: "100% PAYMENT BEFORE DELIVERY",
  remarks: "PRICES ARE VAT-EXCLUSIVE",
  leadTime: "2 - 3 DAYS",
  notes:
    "*DELIVERY FEE IS EXCLUDED AND RATES MAY VARY\n*ASSEMBLY FEE IS PHP 150 PER PC IF REQUESTED TO BE ASSEMBLED BEFORE DELIVERY",
  acknowledgement:
    "THIS QUOTATION IS BASED ON THE DETAILS AND LAYOUT VERIFIED BY THE CLIENT. ANY REVISION ON THE APPROVED DETAILS AND UNREASONABLE CHANGE ON MIND WILL BE CHARGED ACCORDINGLY.\nI HEREBY AGREE TO ALL ABOVE TERMS AND CONDITIONS.",
} as const;

/** "8 pcs", "1 set", "2 sets". "pcs" is already plural; the other units take an "s". */
export function countWithUom(count: number, uom: Uom): string {
  return uom === "pcs" || count === 1 ? `${count} ${uom}` : `${count} ${uom}s`;
}

/** "8 pcs", "8 pcs and 2 sets", "8 pcs, 2 sets and 1 pair". */
function joinAnd(parts: string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * What is left to deliver, summed per unit in line order: "8 pcs and 2 sets". Empty
 * when everything has been delivered.
 */
export function remainingByUom(
  lines: { uom: Uom; remaining: number }[],
): string {
  const totals = new Map<Uom, number>();
  for (const { uom, remaining } of lines) {
    if (remaining > 0) totals.set(uom, (totals.get(uom) ?? 0) + remaining);
  }
  return joinAnd([...totals].map(([uom, count]) => countWithUom(count, uom)));
}

/** A receipt's lines in short: "2 × KK-DG-D4, 5 × KK-GF-Z014". The name stands in for a missing code. */
export function receiptItemsSummary(
  items: { quantity: number; line: { code: string; name: string } }[],
): string {
  return items
    .map(({ quantity, line }) => `${quantity} × ${line.code || line.name}`)
    .join(", ");
}

/**
 * Printed on every delivery receipt. BIR RR 7-2024 requires it on supplementary
 * documents; kept in one place in case the owner's accountant asks for other wording.
 */
export const INPUT_TAX_NOTICE =
  "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX";

/** The letterhead's phones: "{phone} / {phone2}", without the slash when one is empty. */
export function phoneLine(phone: string, phone2: string): string {
  return [phone, phone2]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" / ");
}

// en-CA formats as YYYY-MM-DD.
const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in the shop's time zone, "YYYY-MM-DD". The server runs in UTC. */
export function documentToday(now: Date): string {
  return manilaDate.format(now);
}
