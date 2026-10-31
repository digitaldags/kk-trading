import { cx } from "@/components/ui/shared/cx";
import { grandTotal } from "@/lib/domain/documents";
import type { QuotationWithItems } from "@/lib/domain/types";
import { formatDocumentDate, formatPesoExact } from "@/lib/format";
import styles from "./document.module.css";
import { ItemsTable } from "./ItemsTable";
import { Letterhead, type LetterheadSettings } from "./Letterhead";
import { CustomerInfo, MetaField } from "./MetaField";
import { SignatureLine } from "./SignatureLine";

/** Printed blank, as on the owner's sample. */
const BLANK_TOTALS = ["Subtotal", "Discounts", "Tax rate", "Sales tax"];

/**
 * The printed quotation (Figma 78:1190), in the order of the owner's sample: letterhead,
 * meta, items, remarks and totals, acknowledgement, then signatures. No Optionals.
 */
export function QuotationPrint({
  quotation,
  settings,
  icons,
}: {
  quotation: QuotationWithItems;
  settings: LetterheadSettings;
  /** Category icon by product id, for lines without a photo. */
  icons: Record<string, string>;
}) {
  const notes = quotation.notes.split("\n").filter((line) => line.trim());

  return (
    <div className={cx(styles.document, "t-print-body")}>
      <Letterhead
        settings={settings}
        title="QUOTATION"
        draft={quotation.status === "draft"}
      />

      <dl className={styles.meta}>
        <MetaField label="Date">
          {formatDocumentDate(quotation.quoteDate)}
        </MetaField>
        <MetaField label="No.">{quotation.number}</MetaField>
        <MetaField label="Delivery Term">{quotation.deliveryTerm}</MetaField>
        <MetaField label="Remarks">{quotation.remarks}</MetaField>
        <MetaField label="Payment Terms" className={styles.wide}>
          {quotation.paymentTerms}
        </MetaField>
        <MetaField label="Customer Information">
          <CustomerInfo
            name={quotation.customerName}
            address={quotation.customerAddress}
            tin={quotation.customerTin}
          />
        </MetaField>
        <MetaField label="Delivery Address" className={styles.wide}>
          {quotation.deliveryAddress}
        </MetaField>
      </dl>

      <ItemsTable
        lines={quotation.items.map((line) => ({
          line,
          quantity: line.quantity,
        }))}
        icons={icons}
        prices
      />

      <section className={styles.closing} aria-label="Remarks and totals">
        <div>
          <h2 className={cx(styles.remarksHeading, "t-print-strong")}>
            REMARKS
          </h2>
          {quotation.leadTime && (
            <p className={styles.leadTime}>
              <span>LEAD TIME:</span>
              <span>{quotation.leadTime}</span>
            </p>
          )}
          {notes.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <dl className={styles.totals}>
          {BLANK_TOTALS.map((label) => (
            <div key={label} className={styles.totalRow}>
              <dt>{label}</dt>
              <dd />
            </div>
          ))}
          <div className={cx(styles.totalRow, styles.grand, "t-print-heading")}>
            <dt>GRAND TOTAL</dt>
            <dd>{formatPesoExact(grandTotal(quotation.items))}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.acknowledgement}>
        <h2 className={cx(styles.centered, "t-print-strong")}>
          FORMAL QUOTATION ACKNOWLEDGEMENT
        </h2>
        <p className={styles.preLine}>{quotation.acknowledgement}</p>
      </section>

      <div className={styles.signatures}>
        <SignatureLine label="CLIENT NAME AND SIGNATURE:" />
        <SignatureLine label="DATE:" />
      </div>
    </div>
  );
}
