import { useId } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/shared/cx";
import { CATEGORY_ICONS, type CategoryIcon } from "@/lib/domain/icons";
import styles from "./IconPicker.module.css";

type IconPickerProps = {
  value: CategoryIcon;
  onChange: (icon: CategoryIcon) => void;
  /** Focus target for an error: the checked radio gets this id. */
  id?: string;
  error?: string;
};

/** "fitness_center" → "fitness center", the icon's accessible name. */
export const iconLabel = (icon: string) => icon.replace(/_/g, " ");

/**
 * The category icon grid (Figma 12:1030). Native radio buttons in one group, so Tab
 * lands on the selected icon and the arrow keys move the selection, with no script.
 */
export function IconPicker({ value, onChange, id, error }: IconPickerProps) {
  const name = useId();
  const errorId = error ? `${name}-error` : undefined;
  return (
    <fieldset className={styles.field} aria-describedby={errorId}>
      <legend className={cx(styles.legend, "t-label-small")}>Icon</legend>
      <div className={styles.grid}>
        {CATEGORY_ICONS.map((icon) => (
          <label
            key={icon}
            className={cx(styles.tile, icon === value && styles.checked)}
          >
            <input
              type="radio"
              name={name}
              value={icon}
              id={icon === value ? id : undefined}
              checked={icon === value}
              aria-label={iconLabel(icon)}
              className="visually-hidden"
              onChange={() => onChange(icon)}
            />
            <Icon name={icon} />
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className={cx(styles.error, "t-label-small")}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
