import type { ReactNode } from "react";
import { cx } from "@/components/ui/shared/cx";
import styles from "./EmptyState.module.css";

/** An admin section that isn't built yet. */
export function SectionPlaceholder({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.empty}>
      <h1 className="t-title-large">{title}</h1>
      <p className={cx(styles.text, "t-body-medium")}>{children}</p>
    </section>
  );
}
