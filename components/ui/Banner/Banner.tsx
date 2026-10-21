import type { ReactNode } from "react";
import { Icon } from "../Icon";
import { cx } from "../shared/cx";
import styles from "./Banner.module.css";

export const BANNER_ICONS = { info: "info", warn: "warning" } as const;

export type BannerProps = {
  tone?: "info" | "warn";
  /** Material Symbols ligature. Defaults to "info" or "warning". */
  icon?: string;
  children: ReactNode;
  className?: string;
};

export function Banner({
  tone = "info",
  icon,
  children,
  className,
}: BannerProps) {
  return (
    <div
      className={cx(styles.banner, styles[tone], "t-body-medium", className)}
    >
      <Icon name={icon ?? BANNER_ICONS[tone]} size={20} />
      <div className={styles.text}>{children}</div>
    </div>
  );
}
