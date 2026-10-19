/** The largest value the `price_centavos` integer column holds. */
export const MAX_PRICE_CENTAVOS = 2_147_483_647;

/**
 * Parses a price typed in pesos into integer centavos: "8950", "8,950" and "₱8,950.50"
 * all work. Returns null for anything else, including negatives and more than 2 decimals.
 */
export function parsePriceToCentavos(input: string | number): number | null {
  const text = String(input).replace(/[₱,\s]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const pesos = Number(match[1]);
  const centavos = Number((match[2] ?? "").padEnd(2, "0"));
  const total = pesos * 100 + centavos;
  return Number.isSafeInteger(total) && total <= MAX_PRICE_CENTAVOS
    ? total
    : null;
}
