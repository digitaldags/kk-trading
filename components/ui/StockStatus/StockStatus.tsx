import { STOCK_LABELS, type StockStatus as Status } from "@/lib/domain/stock";
import { Icon } from "../Icon";
import { cx } from "../shared/cx";
import styles from "./StockStatus.module.css";

export const STOCK_ICONS: Record<Status, string> = {
  in_stock: "check_circle",
  low_stock: "error",
  out_of_stock: "block",
};

export type StockStatusProps = {
  status: Status;
  className?: string;
};

export function StockStatus({ status, className }: StockStatusProps) {
  return (
    <span
      className={cx(styles.status, styles[status], "t-label-small", className)}
    >
      <Icon name={STOCK_ICONS[status]} size={16} />
      {STOCK_LABELS[status]}
    </span>
  );
}
