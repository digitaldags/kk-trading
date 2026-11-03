import Image from "next/image";
import { useId } from "react";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { cx } from "@/components/ui/shared/cx";
import type { Uom } from "@/lib/domain/uom";
import styles from "./QuotationItemRow.module.css";

/** A quotation line as the editor holds it: quantity and price as typed. */
export type EditorLine = {
  productId: string;
  code: string;
  name: string;
  specs: string;
  uom: Uom;
  imageUrl: string | null;
  quantity: string;
  unitPrice: string;
};

/** "{code} · {name}", or the name alone when the product has no code. */
export const lineTitle = (line: Pick<EditorLine, "code" | "name">) =>
  line.code ? `${line.code} · ${line.name}` : line.name;

/** A product's photo, or its category's icon (Figma 73:318, 76:1026). */
export function ProductThumb({
  imageUrl,
  icon,
}: {
  imageUrl: string | null;
  icon: string;
}) {
  return (
    <span className={styles.thumb}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="48px"
          className={styles.image}
        />
      ) : (
        <Icon name={icon} />
      )}
    </span>
  );
}

export type QuotationItemRowProps = {
  line: EditorLine;
  /** Category icon for the thumbnail when there's no photo. */
  icon: string;
  /** The formatted line total, or "—" when the quantity or price isn't valid. */
  total: string;
  error?: string;
  onChange: (
    patch: Partial<Pick<EditorLine, "quantity" | "unitPrice">>,
  ) => void;
  onRemove: () => void;
};

/** One quotation line (Figma 73:318). Wrap it in an `<li>`. */
export function QuotationItemRow({
  line,
  icon,
  total,
  error,
  onChange,
  onRemove,
}: QuotationItemRowProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const specs = line.specs.split("\n").filter(Boolean).join(" · ");

  return (
    <div className={styles.line}>
      <div className={styles.row}>
        <ProductThumb imageUrl={line.imageUrl} icon={icon} />
        <div className={styles.item}>
          <p className={cx(styles.title, "t-label-large")}>{lineTitle(line)}</p>
          {specs && <p className={cx(styles.specs, "t-body-small")}>{specs}</p>}
        </div>
        <span className={cx(styles.uom, "t-body-medium")}>
          <span className={styles.mobileLabel}>UOM </span>
          {line.uom}
        </span>
        <span className={styles.qty}>
          <label htmlFor={`${id}-qty`} className="visually-hidden">
            Quantity for {line.name}
          </label>
          <input
            id={`${id}-qty`}
            value={line.quantity}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={cx(styles.input, styles.qtyInput, "t-body-large")}
            onChange={(event) => onChange({ quantity: event.target.value })}
          />
        </span>
        <span className={styles.price}>
          <label htmlFor={`${id}-price`} className="visually-hidden">
            Unit price for {line.name}
          </label>
          <span className={cx(styles.prefix, "t-body-large")} aria-hidden>
            ₱
          </span>
          <input
            id={`${id}-price`}
            value={line.unitPrice}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={cx(styles.input, styles.priceInput, "t-body-large")}
            onChange={(event) => onChange({ unitPrice: event.target.value })}
          />
        </span>
        <span className={cx(styles.total, "t-label-large")}>{total}</span>
        <span className={styles.remove}>
          <IconButton
            icon="delete"
            tone="danger"
            label={`Remove ${line.code || line.name}`}
            onClick={onRemove}
          />
        </span>
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          className={cx(styles.error, "t-label-small")}
        >
          {error}
        </p>
      )}
    </div>
  );
}
