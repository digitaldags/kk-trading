// Units of measure printed on quotations and delivery receipts (ticket 17). The database
// check constraint `products_uom_check` is built from this list.

export const UOMS = ["pcs", "set", "pair", "unit", "lot"] as const;

export type Uom = (typeof UOMS)[number];

/** Shown in the product editor's select. The stored value is what prints. */
export const UOM_LABELS: Record<Uom, string> = {
  pcs: "pcs (pieces)",
  set: "set",
  pair: "pair",
  unit: "unit",
  lot: "lot",
};
