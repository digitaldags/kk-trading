"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DocumentStatus } from "@/components/ui/DocumentStatus";
import { IconButton } from "@/components/ui/IconButton";
import { useSnackbar } from "@/components/ui/Snackbar";
import { cx } from "@/components/ui/shared/cx";
import {
  documentToday,
  grandTotal,
  receiptItemsSummary,
  remainingByUom,
} from "@/lib/domain/documents";
import type {
  DeliveryReceipt,
  DeliveryReceiptWithItems,
  QuotationWithItems,
} from "@/lib/domain/types";
import { formatPesoExact, formatShortDocumentDate } from "@/lib/format";
import type { ReceiptDefaults } from "@/lib/services/deliveryReceiptService";
import type { CreateReceiptAction, DeleteReceiptAction } from "./actionTypes";
import { quotationPrintUrl, receiptPrintUrl } from "./adminUrl";
import { CreateReceiptDialog } from "./CreateReceiptDialog";
import page from "./DocumentPage.module.css";
import { DocumentPanel as Panel } from "./DocumentPanel";
import { lineTitle } from "./QuotationItemRow";
import styles from "./QuotationView.module.css";

export type QuotationViewProps = {
  /** Completed or declined. */
  quotation: QuotationWithItems;
  /**
   * Completed only: each line's progress, and what a new receipt starts with. Null for
   * a declined quotation.
   */
  receiptDefaults: ReceiptDefaults | null;
  /** Oldest first. Empty for a declined quotation. */
  receipts: DeliveryReceiptWithItems[];
  createReceiptAction: CreateReceiptAction;
  deleteReceiptAction: DeleteReceiptAction;
};

/** "Completed quotations are read-only. 8 pcs and 2 sets are still to be delivered." */
function bannerText(
  quotation: QuotationWithItems,
  lines: ReceiptDefaults["lines"],
): string {
  if (quotation.status !== "completed") {
    return "This quotation was declined and is read-only.";
  }
  const remaining = lines.reduce((sum, line) => sum + line.remaining, 0);
  if (remaining === 0) {
    return "Completed quotations are read-only. Everything has been delivered.";
  }
  const summary = remainingByUom(
    lines.map((line) => ({ uom: line.item.uom, remaining: line.remaining })),
  );
  const verb = remaining === 1 ? "is" : "are";
  return `Completed quotations are read-only. ${summary} ${verb} still to be delivered.`;
}

/**
 * A completed or declined quotation (Figma 77:1150): read-only, with its delivery
 * progress and receipts once it is completed. Drafts open in QuotationEditor.
 */
export function QuotationView({
  quotation,
  receiptDefaults,
  receipts,
  createReceiptAction,
  deleteReceiptAction,
}: QuotationViewProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const [busy, startBusy] = useTransition();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<DeliveryReceipt | null>(null);

  // A refresh can remove the control that had focus: the deleted receipt's row, or
  // Create once everything is delivered. Focus then goes to the receipts panel.
  const receiptsTitleRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef(false);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) {
      receiptsTitleRef.current?.focus();
    }
  }, [receipts]);

  const completed = quotation.status === "completed";
  const lines = completed ? (receiptDefaults?.lines ?? []) : [];
  const canCreate =
    completed &&
    receiptDefaults !== null &&
    lines.some((line) => line.remaining > 0);

  const decidedAt = completed ? quotation.completedAt : quotation.declinedAt;
  const meta = `Quotation · ${completed ? "Completed" : "Declined"}${
    decidedAt ? ` ${formatShortDocumentDate(documentToday(decidedAt))}` : ""
  }`;

  function confirmDelete() {
    const receipt = deleting;
    if (!receipt) return;
    startBusy(async () => {
      const result = await deleteReceiptAction(receipt.id);
      setDeleting(null);
      snackbar.show(result.message);
      pendingFocus.current = true;
      router.refresh();
    });
  }

  const summary: [string, string][] = [
    ["Date", formatShortDocumentDate(quotation.quoteDate)],
    ["Customer", quotation.customerName],
    ["TIN", quotation.customerTin],
    ["Grand total", formatPesoExact(grandTotal(quotation.items))],
    ["Delivery address", quotation.deliveryAddress],
    ["Delivery term", quotation.deliveryTerm],
    ["Payment terms", quotation.paymentTerms],
  ];

  return (
    <>
      <Button
        href="/admin/documents"
        prefetch={false}
        variant="text"
        icon="arrow_back"
        className={page.back}
      >
        Documents
      </Button>

      <div className={page.titleRow}>
        <div className={page.heading}>
          <div className={page.titleLine}>
            <h1 className={cx(page.title, "t-headline-small")}>
              {quotation.number}
            </h1>
            <DocumentStatus status={quotation.status} />
          </div>
          <p className={cx(page.meta, "t-body-small")}>{meta}</p>
        </div>

        <div className={page.actions}>
          <Button
            href={quotationPrintUrl(quotation.id)}
            target="_blank"
            rel="noopener"
            prefetch={false}
            variant="outlined"
            icon="print"
          >
            Print quotation
          </Button>
          {canCreate && (
            <Button
              icon="local_shipping"
              disabled={busy}
              onClick={() => setCreating(true)}
            >
              Create delivery receipt
            </Button>
          )}
        </div>
      </div>

      <Banner icon="lock" className={page.banner}>
        {bannerText(quotation, lines)}
      </Banner>

      <Panel title="Summary">
        <dl className={styles.summary}>
          {summary.map(([label, value]) => (
            <div key={label} className={styles.pair}>
              <dt className={cx(styles.label, "t-label-medium")}>{label}</dt>
              <dd className={cx(styles.value, "t-body-medium")}>
                {value || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      {completed && (
        <>
          <Panel
            title="Delivery progress"
            description="Ordered quantities from the quotation, and what the delivery receipts so far have covered."
          >
            <table className={cx(styles.table, styles.progress)}>
              <thead className="t-label-medium">
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">UOM</th>
                  <th scope="col" className={styles.end}>
                    Ordered
                  </th>
                  <th scope="col" className={styles.end}>
                    Delivered
                  </th>
                  <th scope="col" className={styles.end}>
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody className="t-body-medium">
                {lines.map(({ item, ordered, delivered, remaining }) => (
                  <tr key={item.id}>
                    <td className={cx(styles.item, "t-label-large")}>
                      {lineTitle(item)}
                    </td>
                    <td>
                      <CellLabel>UOM</CellLabel>
                      {item.uom}
                    </td>
                    <td className={styles.end}>
                      <CellLabel>Ordered</CellLabel>
                      {ordered}
                    </td>
                    <td className={styles.end}>
                      <CellLabel>Delivered</CellLabel>
                      {delivered}
                    </td>
                    <td className={cx(styles.end, styles.remaining)}>
                      <CellLabel>Remaining</CellLabel>
                      {remaining}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Delivery receipts" titleRef={receiptsTitleRef}>
            {receipts.length === 0 ? (
              <p className={cx(styles.empty, "t-body-medium")}>
                No delivery receipts yet.
              </p>
            ) : (
              <table className={cx(styles.table, styles.receipts)}>
                <thead className="t-label-medium">
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Date</th>
                    <th scope="col">Items</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="t-body-medium">
                  {receipts.map((receipt) => (
                    <tr key={receipt.id}>
                      <td className={cx(styles.number, "t-label-large")}>
                        {receipt.number}
                      </td>
                      <td className={styles.date}>
                        <CellLabel>Date</CellLabel>
                        {formatShortDocumentDate(receipt.receiptDate)}
                      </td>
                      <td className={styles.summaryCell}>
                        <CellLabel>Items</CellLabel>
                        {receiptItemsSummary(receipt.items)}
                      </td>
                      <td className={styles.rowActions}>
                        <Button
                          href={receiptPrintUrl(receipt.id)}
                          target="_blank"
                          rel="noopener"
                          prefetch={false}
                          variant="text"
                          icon="print"
                        >
                          Print
                        </Button>
                        <IconButton
                          icon="delete"
                          tone="danger"
                          label={`Delete receipt ${receipt.number}`}
                          disabled={busy}
                          onClick={() => setDeleting(receipt)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}

      {receiptDefaults && (
        <CreateReceiptDialog
          open={creating}
          quotationId={quotation.id}
          defaults={receiptDefaults}
          createAction={createReceiptAction}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            pendingFocus.current = true;
            router.refresh();
          }}
        />
      )}

      <Dialog
        open={deleting !== null}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        title={deleting ? `Delete receipt ${deleting.number}?` : ""}
        showClose={false}
        fullScreenOnMobile={false}
        actions={
          <>
            <Button
              variant="text"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={confirmDelete}>
              Delete receipt
            </Button>
          </>
        }
      >
        <p className={page.dialogText}>
          Its quantities count as not delivered again.
        </p>
      </Dialog>
    </>
  );
}

/** A cell's column name, shown only when the table stacks (the header row is hidden). */
function CellLabel({ children }: { children: string }) {
  return (
    <span className={cx(styles.cellLabel, "t-label-small")} aria-hidden>
      {children}{" "}
    </span>
  );
}
