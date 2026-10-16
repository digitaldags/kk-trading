const pesoWhole = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pesoCents = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats integer centavos as pesos: 895000 -> "₱8,950", 895050 -> "₱8,950.50". */
export function formatPeso(centavos: number): string {
  const formatter = centavos % 100 === 0 ? pesoWhole : pesoCents;
  return formatter.format(centavos / 100);
}
