import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "../Icon";
import { cx } from "../shared/cx";
import styles from "./FilterChip.module.css";

export type FilterChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-pressed"
> & {
  selected: boolean;
  children: ReactNode;
};

export function FilterChip({
  selected,
  children,
  className,
  type = "button",
  ...rest
}: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        styles.chip,
        selected && styles.selected,
        "t-label-large",
        className,
      )}
      {...rest}
    >
      {selected && <Icon name="check" size={18} />}
      {children}
    </button>
  );
}
