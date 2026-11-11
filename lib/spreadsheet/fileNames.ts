import { documentToday } from "@/lib/domain/documents";

export const TEMPLATE_FILE_NAME = "kk-trading-products-template.xlsx";

/** `kk-trading-products-2026-11-06.xlsx`, with the date in Manila. */
export function exportFileName(now: Date): string {
  return `kk-trading-products-${documentToday(now)}.xlsx`;
}
