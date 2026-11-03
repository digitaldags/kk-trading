import { useId, type ReactNode, type Ref } from "react";
import { cx } from "@/components/ui/shared/cx";
import styles from "./DocumentPage.module.css";

/** A titled panel on the quotation pages (Figma 75:915, 77:1150). */
export function DocumentPanel({
  title,
  description,
  titleRef,
  children,
}: {
  title: string;
  description?: string;
  /** Lets the page move focus to the title (it gets `tabIndex={-1}`). */
  titleRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <h2
        id={id}
        ref={titleRef}
        tabIndex={titleRef ? -1 : undefined}
        className={cx(styles.panelTitle, "t-title-medium")}
      >
        {title}
      </h2>
      {description && (
        <p className={cx(styles.description, "t-body-medium")}>{description}</p>
      )}
      {children}
    </section>
  );
}
