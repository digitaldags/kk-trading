import { Icon } from "@/components/ui/Icon";
import { lineTotal } from "@/lib/domain/documents";
import type { QuotationItem } from "@/lib/domain/types";
import { formatAmount } from "@/lib/format";
import styles from "./document.module.css";

/**
 * One printed line (Figma 73:333): the photo or category icon, the code, the spec lines,
 * then the unit and quantity. Quotations add the unit price and total.
 */
export function PrintItemRow({
  line,
  quantity,
  icon,
  prices,
}: {
  line: QuotationItem;
  /** The quotation's quantity, or what this receipt delivers. */
  quantity: number;
  /** The category icon, shown when the line has no photo. */
  icon: string;
  prices: boolean;
}) {
  const specs = line.specs.split("\n").filter((s) => s.trim());
  return (
    <tr className={styles.row}>
      <td>
        <div className={styles.item}>
          <span className={styles.photo}>
            {line.imageUrl ? (
              // Plain and eager, so the photo is there when the print dialog opens.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={line.imageUrl} alt="" loading="eager" decoding="sync" />
            ) : (
              <Icon name={icon} size={32} />
            )}
          </span>
          <div>
            <p className="t-print-strong">{line.code || line.name}</p>
            {specs.map((spec, index) => (
              <p key={index}>{spec}</p>
            ))}
          </div>
        </div>
      </td>
      <td className={styles.center}>{line.uom}</td>
      <td className={styles.center}>{quantity}</td>
      {prices && (
        <>
          <td className={styles.amount}>
            {formatAmount(line.unitPriceCentavos)}
          </td>
          <td className={styles.amount}>
            {formatAmount(lineTotal({ ...line, quantity }))}
          </td>
        </>
      )}
    </tr>
  );
}
