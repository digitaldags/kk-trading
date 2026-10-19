import type { ButtonHTMLAttributes } from "react";
import { Icon } from "../Icon";
import { cx } from "../shared/cx";
import styles from "./IconButton.module.css";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label" | "title"
> & {
  /** Material Symbols ligature. */
  icon: string;
  /** Accessible name, also shown as a tooltip. */
  label: string;
  tone?: "default" | "danger" | "primary";
};

export function IconButton({
  icon,
  label,
  tone = "default",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        styles.iconButton,
        tone !== "default" && styles[tone],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
