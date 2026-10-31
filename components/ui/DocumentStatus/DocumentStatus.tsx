import {
  QUOTATION_STATUS_LABELS,
  type QuotationStatus,
} from "@/lib/domain/documents";
import { Icon } from "../Icon";
import { cx } from "../shared/cx";
import styles from "./DocumentStatus.module.css";

export const DOCUMENT_STATUS_ICONS: Record<QuotationStatus, string> = {
  draft: "edit_note",
  completed: "task_alt",
  declined: "block",
};

export type DocumentStatusProps = {
  status: QuotationStatus;
  className?: string;
};

/** A quotation's status (Figma 73:306). Draft can be edited; the others are locked. */
export function DocumentStatus({ status, className }: DocumentStatusProps) {
  return (
    <span
      className={cx(styles.status, styles[status], "t-label-small", className)}
    >
      <Icon name={DOCUMENT_STATUS_ICONS[status]} size={16} />
      {QUOTATION_STATUS_LABELS[status]}
    </span>
  );
}
