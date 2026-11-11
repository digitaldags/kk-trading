"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { flushSync } from "react-dom";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useSnackbar } from "@/components/ui/Snackbar";
import { cx } from "@/components/ui/shared/cx";
import {
  IMPORT_COLUMNS,
  type ImportErrorKey,
  type ImportPreview,
  type ImportRowInput,
} from "@/lib/domain/productImport";
import type { FieldErrors } from "@/lib/domain/result";
import { TEMPLATE_FILE_NAME } from "@/lib/spreadsheet/fileNames";
import type { ReadResult } from "@/lib/spreadsheet/readProductsFile";
import type { ImportProductsAction, PreviewImportAction } from "./actionTypes";
import { downloadBlob } from "./downloadBlob";
import styles from "./ImportProductsDialog.module.css";

const MAX_LISTED_PRODUCTS = 100;
const MAX_LISTED_ROWS = 50;

type FileRows = {
  rows: ImportRowInput[];
  rowNumbers: number[];
  ignoredColumns: string[];
};

type View =
  | { step: "choose"; checking?: string; error?: string }
  | {
      step: "preview";
      file: FileRows;
      preview: ImportPreview;
      importing?: boolean;
      error?: string;
    }
  | {
      step: "problems";
      file: FileRows;
      errors: FieldErrors<ImportErrorKey>;
    };

export type ImportProductsDialogProps = {
  open: boolean;
  categories: { name: string }[];
  hasUnpublishedChanges: boolean;
  previewAction: PreviewImportAction;
  importAction: ImportProductsAction;
  readFile: (file: File) => Promise<ReadResult>;
  buildTemplate: (categories: { name: string }[]) => Promise<Blob>;
  onClose: () => void;
};

const plural = (count: number, one: string, many: string) =>
  count === 1 ? one : many;

function previewSummary({ toCreate, unchanged }: ImportPreview) {
  const added = `${toCreate} ${plural(toCreate, "product", "products")} will be added.`;
  const skipped =
    unchanged > 0
      ? ` ${unchanged} already ${plural(unchanged, "exists", "exist")} and will be skipped.`
      : "";
  const nothing =
    toCreate === 0
      ? " Nothing to import. Every product in the file already exists."
      : "";
  return `${added}${skipped}${nothing}`;
}

/** Each problem as a line, grouped by Excel row, in column order within a row. */
function problemsByRow(
  errors: FieldErrors<ImportErrorKey>,
  rowNumbers: number[],
) {
  const rows = new Map<number, string[]>();
  for (const { key, header } of IMPORT_COLUMNS) {
    for (const [errorKey, message] of Object.entries(errors)) {
      const [, index, field] = errorKey.split(".");
      if (field !== key || !message) continue;
      const position = Number(index);
      const rowNumber = rowNumbers[position] ?? position + 2;
      const lines = rows.get(rowNumber) ?? [];
      lines.push(`Row ${rowNumber}, ${header}: ${message}`);
      rows.set(rowNumber, lines);
    }
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rowNumber, lines]) => ({ rowNumber, lines }));
}

function problemsSummary(problems: number, rows: number) {
  const counts = `${problems} ${plural(problems, "problem", "problems")} in ${rows} ${plural(rows, "row", "rows")}`;
  return `${counts}. Nothing was imported. Fix the file and choose it again.`;
}

function importedMessage(created: number, unchanged: number) {
  const added = `Imported ${created} ${plural(created, "product", "products")}. Publish to show them on the store.`;
  return unchanged > 0 ? `${added} ${unchanged} skipped.` : added;
}

/**
 * Import products from Excel (ticket 43): choose a file, see what would happen, confirm.
 * The file is read in the browser and never uploaded; the server gets plain rows, and
 * checks them again on import. There's no Figma frame, so it's built from the shared
 * Dialog, Button and Banner.
 */
export function ImportProductsDialog({
  open,
  categories,
  hasUnpublishedChanges,
  previewAction,
  importAction,
  readFile,
  buildTemplate,
  onClose,
}: ImportProductsDialogProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const id = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ step: "choose" });
  const [downloading, setDownloading] = useState(false);

  // Each time it opens, start again from the first step.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setView({ step: "choose" });
  }

  const busy =
    (view.step === "choose" && view.checking !== undefined) ||
    (view.step === "preview" && view.importing === true);

  const fileInputId = `${id}-file`;
  const hintId = `${id}-hint`;
  const alertId = `${id}-alert`;
  const headingId = `${id}-heading`;

  /** Rendered first, so a new alert or heading is there to take focus. */
  function show(next: View, focusId: string) {
    flushSync(() => setView(next));
    document.getElementById(focusId)?.focus();
  }

  // Chrome closes a modal itself on a second Escape, even while `busy` holds it open.
  // When the work ends, catch up with it, or the parent stays open behind a closed dialog.
  function closeIfBrowserClosed() {
    if (contentRef.current?.closest("dialog")?.open === false) onClose();
  }

  async function check(file: File) {
    setView({ step: "choose", checking: file.name });
    const failed = (error: string) => show({ step: "choose", error }, alertId);
    try {
      const read = await readFile(file);
      if (!read.ok) {
        failed(read.error);
        return;
      }
      const { rows, rowNumbers, ignoredColumns } = read;
      const fileRows = { rows, rowNumbers, ignoredColumns };
      const result = await previewAction(rows, rowNumbers);
      if (result.ok) {
        show(
          { step: "preview", file: fileRows, preview: result.data },
          headingId,
        );
      } else if (result.formError) {
        failed(result.formError);
      } else {
        show(
          { step: "problems", file: fileRows, errors: result.fieldErrors },
          headingId,
        );
      }
    } catch {
      failed("Couldn't check that file. Try again.");
    } finally {
      closeIfBrowserClosed();
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again fires `change` again.
    event.target.value = "";
    if (file) void check(file);
  }

  async function commit(file: FileRows, preview: ImportPreview) {
    const current = { step: "preview", file, preview } as const;
    setView({ ...current, importing: true });
    const failed = (error: string) => show({ ...current, error }, alertId);
    try {
      const result = await importAction(file.rows, file.rowNumbers);
      if (result.ok) {
        const { created, unchanged } = result.data;
        snackbar.show(importedMessage(created, unchanged));
        router.refresh();
        onClose();
      } else if (result.formError) {
        failed(result.formError);
      } else {
        show({ step: "problems", file, errors: result.fieldErrors }, headingId);
      }
    } catch {
      // A lost response may mean it worked. Trying again is safe: those rows are skipped.
      failed("Couldn't import the products. Try again.");
    } finally {
      closeIfBrowserClosed();
    }
  }

  async function downloadTemplate() {
    setDownloading(true);
    try {
      downloadBlob(await buildTemplate(categories), TEMPLATE_FILE_NAME);
    } catch {
      show(
        { step: "choose", error: "Couldn't build the template. Try again." },
        alertId,
      );
    } finally {
      setDownloading(false);
    }
  }

  function chooseAnother() {
    show({ step: "choose" }, fileInputId);
  }

  const alert = (message: string | undefined) =>
    message && (
      <p
        id={alertId}
        role="alert"
        tabIndex={-1}
        className={cx(styles.alert, "t-body-medium")}
      >
        {message}
      </p>
    );

  const heading = (text: string) => (
    <h3
      id={headingId}
      tabIndex={-1}
      className={cx(styles.heading, "t-title-medium")}
    >
      {text}
    </h3>
  );

  const chooseAnotherButton = (
    <Button variant="text" disabled={busy} onClick={chooseAnother}>
      Choose another file
    </Button>
  );

  let content;
  let actions;
  let status = "";

  if (view.step === "choose") {
    status = view.checking ? `Checking ${view.checking}…` : "";
    content = (
      <>
        <p className={styles.text}>
          Add many products at once from an Excel file. Products that already
          exist are skipped, and nothing existing is changed.
        </p>
        {hasUnpublishedChanges && (
          <Banner tone="warn">
            You have unpublished changes. Imported products are added to the
            same draft, so Discard on the Publish bar would remove them too.
          </Banner>
        )}
        <div>
          <Button
            variant="text"
            icon="download"
            disabled={busy || downloading}
            onClick={() => void downloadTemplate()}
          >
            Download template
          </Button>
        </div>
        <div className={styles.field}>
          <label
            htmlFor={fileInputId}
            className={cx(styles.label, "t-label-medium")}
          >
            Excel file (.xlsx)
          </label>
          <input
            id={fileInputId}
            type="file"
            accept=".xlsx"
            disabled={busy}
            aria-describedby={hintId}
            className={cx(styles.fileInput, "t-body-medium")}
            onChange={handleFile}
          />
          <p id={hintId} className={cx(styles.hint, "t-label-small")}>
            Up to 500 products and 2 MB. Photos are added afterwards in the
            product editor.
          </p>
        </div>
        {view.checking && (
          <p className="t-body-medium">Checking {view.checking}…</p>
        )}
        {alert(view.error)}
      </>
    );
  } else if (view.step === "preview") {
    const { file, preview } = view;
    const toAdd = preview.rows.filter((row) => row.outcome === "create");
    const hidden = toAdd.length - MAX_LISTED_PRODUCTS;
    const summary = previewSummary(preview);
    status = view.importing ? "Importing the products…" : summary;
    content = (
      <>
        {heading("Preview")}
        <p className={styles.text}>{summary}</p>
        {file.ignoredColumns.length > 0 && (
          <p className={cx(styles.hint, "t-body-medium")}>
            Ignored columns: {file.ignoredColumns.join(", ")}.
          </p>
        )}
        {toAdd.length > 0 && (
          <div
            role="region"
            aria-label="Products to add"
            tabIndex={0}
            className={styles.scroller}
          >
            <ul className={cx(styles.list, "t-body-medium")}>
              {toAdd.slice(0, MAX_LISTED_PRODUCTS).map((row) => (
                <li key={row.index} className={styles.product}>
                  <span className={styles.code}>{row.code}</span>
                  <span>{row.name}</span>
                </li>
              ))}
            </ul>
            {hidden > 0 && (
              <p className={cx(styles.more, "t-body-medium")}>
                and {hidden} more
              </p>
            )}
          </div>
        )}
        {alert(view.error)}
      </>
    );
    actions = (
      <>
        {chooseAnotherButton}
        {toAdd.length > 0 && (
          <Button disabled={busy} onClick={() => void commit(file, preview)}>
            Import {toAdd.length} {plural(toAdd.length, "product", "products")}
          </Button>
        )}
      </>
    );
  } else {
    const rows = problemsByRow(view.errors, view.file.rowNumbers);
    const problems = rows.reduce((sum, row) => sum + row.lines.length, 0);
    const hidden = rows.length - MAX_LISTED_ROWS;
    const summary = problemsSummary(problems, rows.length);
    status = summary;
    content = (
      <>
        {heading("Problems in this file")}
        <p className={styles.text}>{summary}</p>
        <div
          role="region"
          aria-label="Problems by row"
          tabIndex={0}
          className={styles.scroller}
        >
          <ul className={cx(styles.list, "t-body-medium")}>
            {rows.slice(0, MAX_LISTED_ROWS).map(({ rowNumber, lines }) => (
              <li key={rowNumber} className={styles.problem}>
                {lines.map((line) => (
                  <p key={line} className={styles.line}>
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className={cx(styles.more, "t-body-medium")}>
              and {hidden} more {plural(hidden, "row", "rows")}.
            </p>
          )}
        </div>
      </>
    );
    actions = chooseAnotherButton;
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Import products"
      size="wide"
      actions={actions}
    >
      <div
        ref={contentRef}
        className={styles.content}
        aria-busy={busy || undefined}
      >
        {content}
        <p aria-live="polite" className="visually-hidden">
          {status}
        </p>
      </div>
    </Dialog>
  );
}
