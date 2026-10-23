import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { cx } from "../shared/cx";
import rowStyles from "../shared/row.module.css";
import { toneForIndex } from "../shared/tone";
import toneStyles from "../shared/tone.module.css";
import styles from "./CategoryRow.module.css";

export type CategoryRowProps = {
  name: string;
  productCount: number;
  blurb: string;
  /** Material Symbols ligature for the category. */
  icon: string;
  toneIndex: number;
  /** Shows move up and down buttons, for reordering. */
  onMove?: (direction: "up" | "down") => void;
  /** False at the top of the list: the up button is disabled. */
  canMoveUp?: boolean;
  /** False at the bottom of the list: the down button is disabled. */
  canMoveDown?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
};

/** Admin category list row. Wrap it in an `<li>` inside a list. */
export function CategoryRow({
  name,
  productCount,
  blurb,
  icon,
  toneIndex,
  onMove,
  canMoveUp = true,
  canMoveDown = true,
  onEdit,
  onDelete,
  className,
}: CategoryRowProps) {
  const count = `${productCount} ${productCount === 1 ? "product" : "products"}`;
  return (
    <div className={cx(styles.row, className)}>
      <div className={cx(styles.avatar, toneStyles[toneForIndex(toneIndex)])}>
        <Icon name={icon} />
      </div>
      <div className={cx(rowStyles.main, styles.main)}>
        <span className={cx(rowStyles.title, "t-body-large")}>{name}</span>
        <p className={cx(rowStyles.subtitle, "t-body-medium")}>
          {blurb ? `${count} · ${blurb}` : count}
        </p>
      </div>
      <div className={cx(rowStyles.actions, styles.actions)}>
        {onMove && (
          <>
            <IconButton
              icon="arrow_upward"
              label={`Move ${name} up`}
              disabled={!canMoveUp}
              onClick={() => onMove("up")}
            />
            <IconButton
              icon="arrow_downward"
              label={`Move ${name} down`}
              disabled={!canMoveDown}
              onClick={() => onMove("down")}
            />
          </>
        )}
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
