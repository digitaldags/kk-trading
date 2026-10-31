import { cx } from "@/components/ui/shared/cx";
import type { QuotationItem } from "@/lib/domain/types";
import styles from "./document.module.css";
import { PrintItemRow } from "./PrintItemRow";

/** The category icon for a line without a photo, when its product is gone. */
export const FALLBACK_ICON = "inventory_2";

/**
 * The items table. Its header repeats on each printed page, and rows don't split
 * across pages.
 */
export function ItemsTable({
  lines,
  icons,
  prices,
}: {
  lines: { line: QuotationItem; quantity: number }[];
  /** Category icon by product id, for lines without a photo. */
  icons: Record<string, string>;
  prices: boolean;
}) {
  return (
    <table className={cx(styles.items, "t-print-body")}>
      <thead className="t-print-heading">
        <tr>
          <th scope="col">Item Description</th>
          <th scope="col" className={styles.center}>
            UOM
          </th>
          <th scope="col" className={styles.center}>
            Qty
          </th>
          {prices && (
            <>
              <th scope="col" className={styles.amount}>
                Unit price
              </th>
              <th scope="col" className={styles.amount}>
                Total price
              </th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {lines.map(({ line, quantity }) => (
          <PrintItemRow
            key={line.id}
            line={line}
            quantity={quantity}
            icon={icons[line.productId] ?? FALLBACK_ICON}
            prices={prices}
          />
        ))}
      </tbody>
    </table>
  );
}
