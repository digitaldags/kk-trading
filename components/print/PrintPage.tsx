import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/shared/cx";
import { PrintButton } from "./PrintButton";
import styles from "./PrintPage.module.css";

/**
 * A print preview (Figma 78:1190, 78:1307): a toolbar on screen only, then the A4 sheet.
 * In print only the sheet remains, without its shadow, width or padding.
 */
export function PrintPage({
  backHref,
  children,
  className,
}: {
  /** The quotation's page. */
  backHref: string;
  children: ReactNode;
  /** Extra classes for the sheet. */
  className?: string;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <Button
          href={backHref}
          prefetch={false}
          variant="text"
          icon="arrow_back"
          className={styles.back}
        >
          Quotation
        </Button>
        <p className={cx(styles.hint, "t-body-small")}>
          Print preview. Print opens the browser’s print dialog; choose Save as
          PDF to download a copy.
        </p>
        <PrintButton />
      </div>
      {/* Focusable, so keyboard users can scroll a sheet wider than the screen. */}
      <div
        className={styles.scroller}
        role="region"
        aria-label="Print preview"
        tabIndex={0}
      >
        <article className={cx(styles.sheet, className)}>{children}</article>
      </div>
    </main>
  );
}
