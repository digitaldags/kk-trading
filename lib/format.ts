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

const amount = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Document columns: always 2 decimals, no peso sign: 845000 -> "8,450.00". */
export function formatAmount(centavos: number): string {
  return amount.format(centavos / 100);
}

/** Document totals: always 2 decimals: 10257500 -> "₱102,575.00". */
export function formatPesoExact(centavos: number): string {
  return pesoCents.format(centavos / 100);
}

const documentDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** A document's "YYYY-MM-DD" date: "2026-10-27" -> "October 27, 2026". */
export function formatDocumentDate(date: string): string {
  // Read and formatted in UTC, so the calendar day never shifts with the time zone.
  return documentDate.format(new Date(`${date}T00:00:00Z`));
}

const shortDocumentDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** The documents list's date column: "2026-10-27" -> "Oct 27, 2026". */
export function formatShortDocumentDate(date: string): string {
  return shortDocumentDate.format(new Date(`${date}T00:00:00Z`));
}
