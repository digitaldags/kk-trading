"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useTransition,
  type FormEvent,
  type MouseEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { DocumentStatus } from "@/components/ui/DocumentStatus";
import { FilterChip } from "@/components/ui/FilterChip";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/shared/cx";
import {
  deliveryStateLabel,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUSES,
  type QuotationStatus,
} from "@/lib/domain/documents";
import type { QuotationSummary } from "@/lib/domain/types";
import { formatPesoExact, formatShortDocumentDate } from "@/lib/format";
import { documentsUrl, quotationUrl } from "./adminUrl";
import styles from "./DocumentsAdmin.module.css";
import emptyStyles from "./EmptyState.module.css";
import { SEARCH_DEBOUNCE_MS } from "./ProductsAdmin";

const NEW_QUOTATION_URL = "/admin/documents/new";

export type DocumentsAdminProps = {
  /** The quotations matching `q` and `status`. */
  quotations: QuotationSummary[];
  /** Every quotation, whatever the filters. */
  totalCount: number;
  q: string;
  /** Null for All. */
  status: QuotationStatus | null;
};

const CHIPS: { value: QuotationStatus | null; label: string }[] = [
  { value: null, label: "All" },
  ...QUOTATION_STATUSES.map((value) => ({
    value,
    label: QUOTATION_STATUS_LABELS[value],
  })),
];

/**
 * The Documents tab (Figma 74:879): search, status chips and the quotations. Search and
 * chips are plain GET forms that update the URL in place with JavaScript, like the
 * storefront's, so they combine and survive a refresh.
 */
export function DocumentsAdmin({
  quotations,
  totalCount,
  q,
  status,
}: DocumentsAdminProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Back and forward change `q` from outside. Don't overwrite what someone is typing.
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input) input.value = q;
  }, [q]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const currentQuery = () => inputRef.current?.value ?? q;

  function navigate(next: { q: string; status: QuotationStatus | null }) {
    startTransition(() =>
      router.replace(documentsUrl(next), { scroll: false }),
    );
  }

  function handleSearchInput(value: string) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => navigate({ q: value, status }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTimeout(timerRef.current);
    navigate({ q: currentQuery(), status });
  }

  function selectStatus(
    event: MouseEvent<HTMLButtonElement>,
    value: QuotationStatus | null,
  ) {
    event.preventDefault();
    clearTimeout(timerRef.current);
    navigate({ q: currentQuery(), status: value });
  }

  const newQuotation = (
    <Button href={NEW_QUOTATION_URL} prefetch={false} icon="add">
      New quotation
    </Button>
  );

  return (
    <>
      <h1 className="visually-hidden">Documents</h1>

      <div className={styles.toolbar}>
        <form
          action="/admin/documents"
          method="get"
          role="search"
          className={styles.search}
          onSubmit={handleSearchSubmit}
        >
          {status && <input type="hidden" name="status" value={status} />}
          <Icon name="search" />
          <label htmlFor={searchId} className="visually-hidden">
            Search quotations
          </label>
          <input
            ref={inputRef}
            id={searchId}
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by number or customer"
            autoComplete="off"
            enterKeyHint="search"
            className={cx(styles.searchInput, "t-body-large")}
            onChange={(event) => handleSearchInput(event.target.value)}
          />
        </form>
        {newQuotation}
      </div>

      <form action="/admin/documents" method="get" className={styles.chipForm}>
        {q && <input type="hidden" name="q" value={q} />}
        <div
          role="group"
          aria-label="Filter by status"
          className={styles.chips}
        >
          {CHIPS.map((chip) => (
            <FilterChip
              key={chip.value ?? "all"}
              type="submit"
              name="status"
              value={chip.value ?? ""}
              selected={status === chip.value}
              onClick={(event) => selectStatus(event, chip.value)}
            >
              {chip.label}
            </FilterChip>
          ))}
        </div>
      </form>

      <div
        className={cx(styles.results, pending && styles.pending)}
        aria-busy={pending || undefined}
      >
        {totalCount === 0 ? (
          <div className={emptyStyles.empty}>
            <Icon name="description" size={40} />
            <strong className="t-title-medium">No quotations yet.</strong>
            {newQuotation}
          </div>
        ) : quotations.length === 0 ? (
          <div className={emptyStyles.empty}>
            <Icon name="search_off" size={40} />
            <strong className="t-title-medium">
              {q ? (
                <>No quotations match &ldquo;{q}&rdquo;.</>
              ) : (
                `No ${QUOTATION_STATUS_LABELS[status ?? "draft"].toLowerCase()} quotations.`
              )}
            </strong>
          </div>
        ) : (
          <>
            <div className={cx(styles.header, "t-label-medium")} aria-hidden>
              <span>Number</span>
              <span>Customer</span>
              <span>Date</span>
              <span className={styles.total}>Grand total</span>
              <span className={styles.statusCell}>Status</span>
              <span>Delivery</span>
              <span />
            </div>
            <ul className={styles.list} aria-label="Quotations">
              {quotations.map((quotation) => (
                <li key={quotation.id}>
                  <QuotationRow quotation={quotation} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {totalCount > 0 && (
        <p className={cx(styles.hint, "t-body-medium")}>
          Delivery receipts are created from a completed quotation. Open a
          quotation to create or print one.
        </p>
      )}
    </>
  );
}

/** One quotation (Figma 73:307): the whole row is a link to it. */
function QuotationRow({ quotation }: { quotation: QuotationSummary }) {
  const date = formatShortDocumentDate(quotation.quoteDate);
  const total = formatPesoExact(quotation.grandTotalCentavos);
  const delivered = quotation.status === "completed";

  // The link's name comes from its cells. Grid cells have no whitespace between them,
  // so hidden separators keep the words apart ("…KNOCK, Northwind …"). The dash for a
  // draft or declined quotation is visual only.
  return (
    <Link
      href={quotationUrl(quotation.id)}
      prefetch={false}
      className={styles.row}
    >
      <span className={cx(styles.number, "t-label-large")}>
        {quotation.number}
      </span>
      <Separator />
      <span className={cx(styles.customer, "t-body-medium")}>
        {quotation.customerName}
      </span>
      <Separator />
      <span className={cx(styles.date, "t-body-medium")}>{date}</span>
      <Separator />
      <span className={cx(styles.total, "t-label-large")}>{total}</span>
      <Separator />
      <span className={styles.statusCell}>
        <DocumentStatus status={quotation.status} />
      </span>
      {delivered && <Separator />}
      <span
        className={cx(styles.delivery, "t-body-medium")}
        aria-hidden={!delivered || undefined}
      >
        {deliveryStateLabel(quotation.status, quotation.deliveryState)}
      </span>
      <Icon name="chevron_right" className={styles.chevron} />
    </Link>
  );
}

/** ", " for screen readers; absolutely positioned, so it takes no grid cell. */
function Separator() {
  return <span className="visually-hidden">, </span>;
}
