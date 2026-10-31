"use client";

import { useId, useState, useTransition, type ChangeEvent } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useSnackbar } from "@/components/ui/Snackbar";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/shared/cx";
import type { FieldErrors } from "@/lib/domain/result";
import type {
  ReceiptDefaults,
  ReceiptField,
} from "@/lib/services/deliveryReceiptService";
import type { CreateReceiptAction } from "./actionTypes";
import { receiptPrintUrl } from "./adminUrl";
import styles from "./CreateReceiptDialog.module.css";
import { lineTitle } from "./QuotationItemRow";

type Fields = { receiptDate: string; number: string; deliveryAddress: string };

/** In the order they're shown, so the first error gets focus. */
const FIELD_ORDER: (keyof Fields)[] = [
  "receiptDate",
  "number",
  "deliveryAddress",
];

export type CreateReceiptDialogProps = {
  open: boolean;
  quotationId: string;
  /** Today, the number (the quotation's for the first receipt) and what is left per line. */
  defaults: ReceiptDefaults;
  createAction: CreateReceiptAction;
  onClose: () => void;
  /** After a receipt is saved: the page closes the dialog and refreshes. */
  onCreated: () => void;
};

const initialFields = (defaults: ReceiptDefaults): Fields => ({
  receiptDate: defaults.receiptDate,
  number: defaults.number,
  deliveryAddress: defaults.deliveryAddress,
});

const initialQuantities = (defaults: ReceiptDefaults) =>
  Object.fromEntries(
    defaults.lines.map((line) => [line.item.id, String(line.remaining)]),
  );

/**
 * Create delivery receipt (Figma 77:1364). Each line starts at what is left to deliver.
 * "Create and print" saves the receipt and opens its print page in a new tab, or offers
 * a Print link in the snackbar when the browser blocks the tab.
 */
export function CreateReceiptDialog({
  open,
  quotationId,
  defaults,
  createAction,
  onClose,
  onCreated,
}: CreateReceiptDialogProps) {
  const snackbar = useSnackbar();
  const id = useId();
  const [busy, startBusy] = useTransition();
  const [fields, setFields] = useState(() => initialFields(defaults));
  const [quantities, setQuantities] = useState(() =>
    initialQuantities(defaults),
  );
  const [errors, setErrors] = useState<FieldErrors<ReceiptField>>({});
  const [formError, setFormError] = useState<string | undefined>();

  // Each time it opens, start again from the latest defaults (they change after a
  // receipt is created or deleted).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFields(initialFields(defaults));
      setQuantities(initialQuantities(defaults));
      setErrors({});
      setFormError(undefined);
    }
  }

  const fieldId = (key: string) => `${id}-${key}`;
  const lineInputId = (itemId: string) => `${id}-line-${itemId}`;
  const alertId = `${id}-alert`;
  const formId = `${id}-form`;
  const hintId = `${id}-hint`;

  function focusFirstError(found: FieldErrors<ReceiptField>, alert: boolean) {
    const field = FIELD_ORDER.find((key) => found[key]);
    const line = defaults.lines.find((l) => found[`lines.${l.item.id}`]);
    const target = field
      ? fieldId(field)
      : line
        ? lineInputId(line.item.id)
        : alert
          ? alertId
          : null;
    if (target) document.getElementById(target)?.focus();
  }

  function submit() {
    startBusy(async () => {
      const result = await createAction(quotationId, {
        ...fields,
        lines: defaults.lines.map((line) => ({
          quotationItemId: line.item.id,
          quantity: quantities[line.item.id] ?? "0",
        })),
      });
      if (!result.ok) {
        const alert = result.formError ?? result.fieldErrors.lines;
        // Rendered first, so a new alert is there to take focus.
        flushSync(() => {
          setErrors(result.fieldErrors);
          setFormError(alert);
        });
        focusFirstError(result.fieldErrors, alert !== undefined);
        return;
      }
      // Opened after an await, so the browser may block it: then offer the link.
      const url = receiptPrintUrl(result.id);
      const tab = window.open(url, "_blank");
      if (tab) {
        tab.opener = null;
        snackbar.show(result.message);
      } else {
        snackbar.show(result.message, { label: "Print", href: url });
      }
      onCreated();
    });
  }

  const field = (key: keyof Fields) => ({
    id: fieldId(key),
    value: fields[key],
    error: errors[key],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((f) => ({ ...f, [key]: event.target.value })),
  });

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Create delivery receipt"
      size="wide"
      actions={
        <>
          <Button variant="text" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} icon="print" disabled={busy}>
            Create and print
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        aria-busy={busy || undefined}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className={styles.two}>
          <TextField label="Date" type="date" {...field("receiptDate")} />
          <TextField
            label="Number"
            placeholder="Type a receipt number"
            autoComplete="off"
            {...field("number")}
          />
        </div>
        <TextField
          kind="multiline"
          label="Delivery address"
          rows={2}
          {...field("deliveryAddress")}
        />

        <table className={styles.table} aria-describedby={hintId}>
          <thead className="t-label-medium">
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className={styles.end}>
                Remaining
              </th>
              <th scope="col" className={styles.end}>
                Deliver now
              </th>
            </tr>
          </thead>
          <tbody className="t-body-medium">
            {defaults.lines.map(({ item, remaining }) => {
              const error = errors[`lines.${item.id}`];
              const errorId = error
                ? `${lineInputId(item.id)}-error`
                : undefined;
              const done = remaining === 0;
              return (
                <tr key={item.id} className={cx(done && styles.done)}>
                  <td className={cx(styles.item, "t-label-large")}>
                    {lineTitle(item)}
                    {error && (
                      <p
                        id={errorId}
                        role="alert"
                        className={cx(styles.error, "t-label-small")}
                      >
                        {error}
                      </p>
                    )}
                  </td>
                  <td className={styles.end}>
                    <span
                      className={cx(styles.cellLabel, "t-label-small")}
                      aria-hidden
                    >
                      Remaining{" "}
                    </span>
                    {remaining} {item.uom}
                  </td>
                  <td className={styles.deliver}>
                    <label
                      htmlFor={lineInputId(item.id)}
                      className="visually-hidden"
                    >
                      Deliver now for {item.name}
                    </label>
                    <input
                      id={lineInputId(item.id)}
                      type="number"
                      min={0}
                      max={remaining}
                      step={1}
                      inputMode="numeric"
                      autoComplete="off"
                      value={done ? "0" : (quantities[item.id] ?? "")}
                      disabled={done}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={errorId}
                      className={cx(styles.input, "t-body-large")}
                      onChange={(event) =>
                        setQuantities((q) => ({
                          ...q,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {formError && (
          <p
            id={alertId}
            role="alert"
            tabIndex={-1}
            className={cx(styles.error, "t-body-small")}
          >
            {formError}
          </p>
        )}

        <p id={hintId} className={cx(styles.hint, "t-label-small")}>
          Quantities default to what is left to deliver and can’t be more than
          that. Items set to 0 are left off the receipt. Receipt numbers must be
          unique, so a later receipt needs its own number.
        </p>
      </form>
    </Dialog>
  );
}
