"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DocumentStatus } from "@/components/ui/DocumentStatus";
import { useSnackbar } from "@/components/ui/Snackbar";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/shared/cx";
import { grandTotal, lineTotal } from "@/lib/domain/documents";
import { parsePriceToCentavos } from "@/lib/domain/price";
import type { FieldErrors } from "@/lib/domain/result";
import type {
  Category,
  ProductWithCategory,
  QuotationWithItems,
} from "@/lib/domain/types";
import { formatAmount, formatPesoExact, formatSavedAt } from "@/lib/format";
import type {
  QuotationDraftDefaults,
  QuotationField,
} from "@/lib/services/quotationService";
import type { QuotationAction, SaveQuotationAction } from "./actionTypes";
import { AddProductDialog } from "./AddProductDialog";
import { quotationUrl } from "./adminUrl";
import styles from "./QuotationEditor.module.css";
import { QuotationItemRow, type EditorLine } from "./QuotationItemRow";

/** The header fields, as typed. */
type Fields = {
  number: string;
  quoteDate: string;
  customerName: string;
  customerAddress: string;
  customerTin: string;
  deliveryAddress: string;
  deliveryTerm: string;
  paymentTerms: string;
  remarks: string;
  leadTime: string;
  notes: string;
  acknowledgement: string;
};

/** In the order they're shown, so the first error gets focus. */
const FIELD_ORDER: (keyof Fields)[] = [
  "quoteDate",
  "number",
  "deliveryTerm",
  "paymentTerms",
  "remarks",
  "leadTime",
  "customerName",
  "customerTin",
  "customerAddress",
  "deliveryAddress",
  "notes",
  "acknowledgement",
];

/** The product a line came from may be gone from the catalog: a generic icon then. */
const FALLBACK_ICON = "inventory_2";

type Confirming = "complete" | "decline" | "delete";

const CONFIRM_COPY: Record<
  Confirming,
  { title: string; text: string; button: string }
> = {
  complete: {
    title: "Mark as completed?",
    text: "The quotation can't be edited after this.",
    button: "Mark as completed",
  },
  decline: {
    title: "Mark as declined?",
    text: "The quotation can't be edited after this.",
    button: "Mark as declined",
  },
  delete: {
    title: "Delete this draft?",
    text: "This can't be undone.",
    button: "Delete draft",
  },
};

export type QuotationEditorProps = {
  /** Null for a new quotation, which starts from `defaults`. */
  quotation: QuotationWithItems | null;
  defaults: QuotationDraftDefaults;
  /** The live catalog, for Add product and the line thumbnails. */
  catalog: ProductWithCategory[];
  categories: Category[];
  saveAction: SaveQuotationAction;
  completeAction: QuotationAction;
  declineAction: QuotationAction;
  deleteAction: QuotationAction;
};

function initialState(
  quotation: QuotationWithItems | null,
  defaults: QuotationDraftDefaults,
): { fields: Fields; lines: EditorLine[] } {
  const source = quotation ?? defaults;
  const fields = Object.fromEntries(
    FIELD_ORDER.map((key) => [key, source[key]]),
  ) as Fields;
  const lines = (quotation?.items ?? []).map((item): EditorLine => ({
    productId: item.productId,
    code: item.code,
    name: item.name,
    specs: item.specs,
    uom: item.uom,
    imageUrl: item.imageUrl,
    quantity: String(item.quantity),
    unitPrice: formatAmount(item.unitPriceCentavos),
  }));
  return { fields, lines };
}

const serialize = (fields: Fields, lines: EditorLine[]) =>
  JSON.stringify({ fields, lines });

/** A line's quantity and price as numbers, or null while either isn't valid. */
function parseLine(line: EditorLine) {
  const quantity = /^\s*\d+\s*$/.test(line.quantity)
    ? Number(line.quantity)
    : null;
  const unitPriceCentavos = parsePriceToCentavos(line.unitPrice);
  return quantity === null || unitPriceCentavos === null
    ? null
    : { quantity, unitPriceCentavos };
}

/** Formats a total, or "—" if it can't be computed exactly. */
function money(compute: () => number): string {
  try {
    return formatPesoExact(compute());
  } catch {
    return "—";
  }
}

/**
 * The quotation editor (Figma 75:915). It keeps its own state: saving doesn't reload
 * the page, and the first save swaps `/new` for the quotation's URL in place. Completed
 * and declined quotations open read-only (ticket 22 gives them their own view).
 */
export function QuotationEditor({
  quotation,
  defaults,
  catalog,
  categories,
  saveAction,
  completeAction,
  declineAction,
  deleteAction,
}: QuotationEditorProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const id = useId();
  const [busy, startBusy] = useTransition();

  const [initial] = useState(() => initialState(quotation, defaults));
  const [fields, setFields] = useState(initial.fields);
  const [lines, setLines] = useState(initial.lines);
  const [snapshot, setSnapshot] = useState(() =>
    serialize(initial.fields, initial.lines),
  );
  const [saved, setSaved] = useState(
    quotation && {
      id: quotation.id,
      number: quotation.number,
      updatedAt: quotation.updatedAt,
    },
  );
  const [errors, setErrors] = useState<FieldErrors<QuotationField>>({});
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<Confirming | null>(null);

  const status = quotation?.status ?? "draft";
  const readOnly = status !== "draft";
  const dirty = !readOnly && serialize(fields, lines) !== snapshot;

  // Leaving with unsaved edits: the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const icons = new Map(catalog.map((p) => [p.id, p.category.icon]));
  const addedIds = new Set(lines.map((line) => line.productId));
  const parsed = lines.map(parseLine);
  const total = money(() => grandTotal(parsed.filter((line) => line !== null)));

  const fieldId = (key: string) => `${id}-${key}`;

  function set(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  /** Line errors are keyed by index, so any change to the lines clears them. */
  function changeLines(change: (lines: EditorLine[]) => EditorLine[]) {
    setLines(change);
    setErrors((e) =>
      Object.fromEntries(
        Object.entries(e).filter(([key]) => !key.startsWith("items")),
      ),
    );
  }

  function addProduct(product: ProductWithCategory) {
    changeLines((current) => [
      ...current,
      {
        productId: product.id,
        code: product.code,
        name: product.name,
        specs: product.specs,
        uom: product.uom,
        imageUrl: product.imageUrl,
        quantity: "1",
        unitPrice: formatAmount(product.priceCentavos),
      },
    ]);
  }

  function focusFirstError(found: FieldErrors<QuotationField>) {
    const field = FIELD_ORDER.find((key) => found[key]);
    if (field) {
      document.getElementById(fieldId(field))?.focus();
      return;
    }
    const line = Object.keys(found).find((key) => key.startsWith("items."));
    if (line) {
      document
        .querySelector<HTMLInputElement>(
          `[data-line="${line.slice("items.".length)}"] input`,
        )
        ?.focus();
    }
  }

  /** Saves the draft. Returns its id, or null when the save was refused. */
  async function save(): Promise<string | null> {
    const sent = serialize(fields, lines);
    const result = await saveAction({
      ...(saved ? { id: saved.id } : {}),
      ...fields,
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    });
    if (!result.ok) {
      setErrors(result.fieldErrors);
      if (result.formError) snackbar.show(result.formError);
      focusFirstError(result.fieldErrors);
      return null;
    }
    setErrors({});
    setSnapshot(sent);
    setSaved({
      id: result.id,
      number: result.number,
      updatedAt: new Date(result.updatedAt),
    });
    // The first save: show the quotation's own URL, so a refresh opens it, without
    // remounting the editor (Next.js keeps usePathname in sync with replaceState).
    if (!saved) window.history.replaceState(null, "", quotationUrl(result.id));
    snackbar.show(result.message);
    return result.id;
  }

  function handleSave() {
    startBusy(async () => {
      await save();
    });
  }

  /** Completing or declining saves any edits first, then asks. */
  function requestLock(kind: "complete" | "decline") {
    startBusy(async () => {
      if (!saved || dirty) {
        if (!(await save())) return;
      }
      setConfirming(kind);
    });
  }

  function confirm() {
    const kind = confirming;
    const quotationId = saved?.id;
    if (!kind || !quotationId) return;
    startBusy(async () => {
      const action =
        kind === "complete"
          ? completeAction
          : kind === "decline"
            ? declineAction
            : deleteAction;
      const result = await action(quotationId);
      setConfirming(null);
      snackbar.show(result.message);
      if (!result.ok) return;
      // Nothing left to lose: don't ask before leaving.
      setSnapshot(serialize(fields, lines));
      router.replace(
        kind === "delete" ? "/admin/documents" : quotationUrl(quotationId),
      );
    });
  }

  const field = (key: keyof Fields) => ({
    id: fieldId(key),
    value: fields[key],
    error: errors[key],
    readOnly,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, event.target.value),
  });

  const heading = saved?.number || "New quotation";
  const numberHintId = `${id}-number-hint`;
  const copy = confirming ? CONFIRM_COPY[confirming] : null;

  return (
    <>
      <Button
        href="/admin/documents"
        prefetch={false}
        variant="text"
        icon="arrow_back"
        className={styles.back}
      >
        Documents
      </Button>

      <div className={styles.titleRow}>
        <div className={styles.heading}>
          <div className={styles.titleLine}>
            <h1 className={cx(styles.title, "t-headline-small")}>{heading}</h1>
            <DocumentStatus status={status} />
          </div>
          <p className={cx(styles.meta, "t-body-small")}>
            Quotation ·{" "}
            {saved
              ? `Last saved ${formatSavedAt(saved.updatedAt)}`
              : "Not saved yet"}
          </p>
        </div>

        <div className={styles.actions}>
          {!readOnly && saved && (
            <Button
              variant="text"
              className={styles.danger}
              disabled={busy}
              onClick={() => setConfirming("delete")}
            >
              Delete draft
            </Button>
          )}
          {saved ? (
            <Button
              href={`/admin/print/quotations/${saved.id}`}
              target="_blank"
              rel="noopener"
              prefetch={false}
              variant="outlined"
              icon="print"
            >
              Print preview
            </Button>
          ) : (
            <Button variant="outlined" icon="print" disabled>
              Print preview
            </Button>
          )}
          {!readOnly && (
            <>
              <Button
                variant="text"
                disabled={busy}
                onClick={() => requestLock("decline")}
              >
                Mark as declined
              </Button>
              <Button
                variant="tonal"
                icon="task_alt"
                disabled={busy}
                onClick={() => requestLock("complete")}
              >
                Mark as completed
              </Button>
              <Button disabled={busy} onClick={handleSave}>
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <Banner className={styles.banner}>
        {readOnly
          ? `This quotation is ${status}. It can't be edited.`
          : "Drafts can be edited. Marking a quotation as completed or declined locks it. Delivery receipts can be created once it is completed."}
      </Banner>

      <form
        className={styles.form}
        aria-busy={busy || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          if (!readOnly) handleSave();
        }}
      >
        <Panel title="Quotation details">
          <div className={styles.two}>
            <TextField label="Date" type="date" {...field("quoteDate")} />
            <TextField
              label="Number"
              autoComplete="off"
              aria-describedby={numberHintId}
              {...field("number")}
            />
            <TextField label="Delivery term" {...field("deliveryTerm")} />
            <TextField label="Payment terms" {...field("paymentTerms")} />
            <TextField label="Remarks" {...field("remarks")} />
            <TextField label="Lead time" {...field("leadTime")} />
          </div>
          <p id={numberHintId} className={cx(styles.hint, "t-label-small")}>
            Typed by hand. Saving is blocked if another quotation already uses
            this number.
          </p>
        </Panel>

        <Panel
          title="Customer"
          description="Typed for each quotation. Copied to the delivery receipt."
        >
          <div className={styles.two}>
            <TextField label="Customer name" {...field("customerName")} />
            <TextField label="TIN" {...field("customerTin")} />
            <TextField
              kind="multiline"
              label="Customer address"
              rows={2}
              {...field("customerAddress")}
            />
            <TextField
              kind="multiline"
              label="Delivery address"
              rows={2}
              {...field("deliveryAddress")}
            />
          </div>
        </Panel>

        <Panel
          title="Items"
          description="Products come from the catalog. Unit price starts at the catalog price and can be changed for this quotation only."
        >
          {lines.length === 0 ? (
            <p className={cx(styles.empty, "t-body-medium")}>
              No products yet. Add products from the catalog.
            </p>
          ) : (
            <div className={styles.items}>
              <div
                className={cx(styles.itemsHeader, "t-label-medium")}
                aria-hidden
              >
                <span className={styles.itemColumn}>Item</span>
                <span>UOM</span>
                <span className={styles.end}>Qty</span>
                <span className={styles.end}>Unit price</span>
                <span className={styles.end}>Total</span>
                <span />
              </div>
              <ul className={styles.lines} aria-label="Items">
                {lines.map((line, index) => (
                  <li key={line.productId} data-line={index}>
                    <QuotationItemRow
                      line={line}
                      icon={icons.get(line.productId) ?? FALLBACK_ICON}
                      total={
                        parsed[index]
                          ? money(() => lineTotal(parsed[index]!))
                          : "—"
                      }
                      error={errors[`items.${index}`]}
                      readOnly={readOnly}
                      onChange={(patch) =>
                        changeLines((current) =>
                          current.map((l, i) =>
                            i === index ? { ...l, ...patch } : l,
                          ),
                        )
                      }
                      onRemove={() =>
                        changeLines((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {errors.items && (
            <p role="alert" className={cx(styles.error, "t-body-small")}>
              {errors.items}
            </p>
          )}
          {!readOnly && (
            <div>
              <Button
                variant="outlined"
                icon="add"
                onClick={() => setAdding(true)}
              >
                Add product
              </Button>
            </div>
          )}
        </Panel>

        <Panel
          title="Notes and terms"
          description="Pre-filled with the text from the current quotation. Changes apply to this quotation only."
        >
          <TextField
            kind="multiline"
            label="Remarks"
            rows={3}
            {...field("notes")}
          />
          <TextField
            kind="multiline"
            label="Acknowledgement"
            rows={3}
            {...field("acknowledgement")}
          />
        </Panel>

        <Panel
          title="Totals"
          description="Subtotal, discounts, tax rate and sales tax print blank, the same as the current quotation."
        >
          <dl className={styles.totals}>
            <div className={cx(styles.totalRow, "t-body-medium")}>
              <dt>Items</dt>
              <dd>{total}</dd>
            </div>
            <div className={cx(styles.grandRow, "t-title-medium")}>
              <dt>Grand total</dt>
              <dd className={cx(styles.grandTotal, "t-title-large")}>
                {total}
              </dd>
            </div>
          </dl>
        </Panel>
      </form>

      {!readOnly && (
        <AddProductDialog
          open={adding}
          products={catalog}
          categories={categories}
          addedIds={addedIds}
          onAdd={addProduct}
          onClose={() => setAdding(false)}
        />
      )}

      <Dialog
        open={copy !== null}
        onClose={() => {
          if (!busy) setConfirming(null);
        }}
        title={copy?.title ?? ""}
        showClose={false}
        fullScreenOnMobile={false}
        actions={
          <>
            <Button
              variant="text"
              disabled={busy}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
            <Button
              variant={confirming === "delete" ? "danger" : "filled"}
              disabled={busy}
              onClick={confirm}
            >
              {copy?.button}
            </Button>
          </>
        }
      >
        <p className={styles.dialogText}>{copy?.text}</p>
      </Dialog>
    </>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <h2 id={id} className={cx(styles.panelTitle, "t-title-medium")}>
        {title}
      </h2>
      {description && (
        <p className={cx(styles.description, "t-body-medium")}>{description}</p>
      )}
      {children}
    </section>
  );
}
