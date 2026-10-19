import type { CSSProperties } from "react";
import styles from "./Icon.module.css";

type IconProps = {
  /** Material Symbols Rounded ligature name, e.g. "chair". */
  name: string;
  /** Size in px. Also sets the optical size axis (clamped to the font's 20–48 range). */
  size?: number;
  /** Filled variant. */
  fill?: boolean;
  className?: string;
};

export function Icon({ name, size = 24, fill = false, className }: IconProps) {
  const style = {
    "--icon-size": `${size}px`,
    "--icon-opsz": Math.min(48, Math.max(20, size)),
    "--icon-fill": fill ? 1 : 0,
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      className={className ? `${styles.icon} ${className}` : styles.icon}
      style={style}
    >
      {name}
    </span>
  );
}
