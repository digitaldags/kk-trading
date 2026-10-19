import Image from "next/image";
import type { StockStatus as Status } from "@/lib/domain/stock";
import { formatPeso } from "@/lib/format";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { StockStatus } from "../StockStatus";
import { cx } from "../shared/cx";
import rowStyles from "../shared/row.module.css";
import { toneForIndex } from "../shared/tone";
import toneStyles from "../shared/tone.module.css";
import styles from "./ProductRow.module.css";

export type ProductRowProps = {
  name: string;
  /** For example "Office equipment · Seat height 44–54 cm". */
  subtitle: string;
  priceCentavos: number;
  status: Status;
  /** Shows the Sample tag. */
  sample?: boolean;
  imageUrl?: string | null;
  /** Category icon, shown when there's no photo. */
  icon: string;
  toneIndex: number;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
};

/** Admin product list row. Wrap it in an `<li>` inside a list. */
export function ProductRow({
  name,
  subtitle,
  priceCentavos,
  status,
  sample = false,
  imageUrl,
  icon,
  toneIndex,
  onEdit,
  onDelete,
  className,
}: ProductRowProps) {
  return (
    <div className={cx(styles.row, className)}>
      <div className={cx(styles.thumb, toneStyles[toneForIndex(toneIndex)])}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="56px"
            className={styles.image}
          />
        ) : (
          <Icon name={icon} size={28} />
        )}
      </div>
      <div className={cx(rowStyles.main, styles.mainArea)}>
        <div className={styles.titleRow}>
          <span className={cx(rowStyles.title, "t-body-large")}>{name}</span>
          {sample && (
            <span className={cx(styles.tag, "t-label-tag")}>Sample</span>
          )}
        </div>
        <p className={cx(rowStyles.subtitle, "t-body-medium")}>{subtitle}</p>
      </div>
      <span className={cx(styles.price, "t-body-large")}>
        {formatPeso(priceCentavos)}
      </span>
      <StockStatus status={status} className={styles.status} />
      <div className={cx(rowStyles.actions, styles.actionsArea)}>
        {onEdit && (
          <IconButton icon="edit" label={`Edit ${name}`} onClick={onEdit} />
        )}
        {onDelete && (
          <IconButton
            icon="delete"
            tone="danger"
            label={`Delete ${name}`}
            onClick={onDelete}
          />
        )}
      </div>
    </div>
  );
}
