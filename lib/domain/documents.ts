// Quotations and delivery receipts (tickets 18–24). Admin-only records: never part of
// draft and publish. The database check constraint `quotations_status_check` is built
// from QUOTATION_STATUSES.

export const QUOTATION_STATUSES = ["draft", "completed", "declined"] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/** How much of a quotation's lines its delivery receipts cover. */
export const DELIVERY_STATES = ["none", "partial", "full"] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];
