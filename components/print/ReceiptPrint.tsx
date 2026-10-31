import { cx } from "@/components/ui/shared/cx";
import { INPUT_TAX_NOTICE } from "@/lib/domain/documents";
import type { DeliveryReceiptWithItems, Quotation } from "@/lib/domain/types";
import { formatDocumentDate } from "@/lib/format";
import styles from "./document.module.css";
import { ItemsTable } from "./ItemsTable";
import { Letterhead, type LetterheadSettings } from "./Letterhead";
import { CustomerInfo, MetaField } from "./MetaField";
import { SignatureLine } from "./SignatureLine";

/**
 * The printed delivery receipt (Figma 78:1307): only this receipt's lines and
 * quantities, no prices, the input-tax notice, and the signature lines at the bottom.
 */
export function ReceiptPrint({
  receipt,
  quotation,
  settings,
  icons,
}: {
  receipt: DeliveryReceiptWithItems;
  /** The customer details come from the quotation. */
  quotation: Pick<
    Quotation,
    "customerName" | "customerAddress" | "customerTin"
  >;
  settings: LetterheadSettings;
  /** Category icon by product id, for lines without a photo. */
  icons: Record<string, string>;
}) {
  return (
    <div className={cx(styles.document, styles.receipt, "t-print-body")}>
      <Letterhead settings={settings} title="DELIVERY RECEIPT" />

      <dl className={cx(styles.meta, styles.receiptMeta)}>
        <MetaField label="Date">
          {formatDocumentDate(receipt.receiptDate)}
        </MetaField>
        <MetaField label="No." className={styles.wide}>
          {receipt.number}
        </MetaField>
        <MetaField label="Customer Information">
          <CustomerInfo
            name={quotation.customerName}
            address={quotation.customerAddress}
            tin={quotation.customerTin}
          />
        </MetaField>
        <MetaField label="Delivery Address" className={styles.wide}>
          {receipt.deliveryAddress}
        </MetaField>
      </dl>

      <ItemsTable
        lines={receipt.items.map((item) => ({
          line: item.line,
          quantity: item.quantity,
        }))}
        icons={icons}
        prices={false}
      />

      <div className={styles.receiptEnd}>
        <p className={cx(styles.notice, "t-print-heading")}>
          {INPUT_TAX_NOTICE}
        </p>
        <div className={styles.receiptSignatures}>
          <SignatureLine label="PREPARED BY:" caption="NAME AND SIGNATURE" />
          <SignatureLine label="RECEIVED BY:" caption="NAME AND SIGNATURE" />
          <span />
          <SignatureLine label="DATE:" />
        </div>
      </div>
    </div>
  );
}
