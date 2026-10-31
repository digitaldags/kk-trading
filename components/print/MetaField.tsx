import type { ReactNode } from "react";
import { cx } from "@/components/ui/shared/cx";
import styles from "./document.module.css";

/** A label and its value in the meta grid: "Date" over "October 27, 2026". */
export function MetaField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(styles.field, className)}>
      <dt className="t-print-heading">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Customer information: the name, the address, then the TIN when there is one. */
export function CustomerInfo({
  name,
  address,
  tin,
}: {
  name: string;
  address: string;
  tin: string;
}) {
  return (
    <>
      <span className={styles.block}>{name}</span>
      {address && <span className={styles.block}>{address}</span>}
      {tin && <span className={styles.block}>TIN: {tin}</span>}
    </>
  );
}
