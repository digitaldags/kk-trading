import Image from "next/image";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { StockStatus } from "@/components/ui/StockStatus";
import { cx } from "@/components/ui/shared/cx";
import { toneForIndex } from "@/components/ui/shared/tone";
import toneStyles from "@/components/ui/shared/tone.module.css";
import type { ProductWithCategory, StoreSettings } from "@/lib/domain/types";
import { formatPeso } from "@/lib/format";
import { mailtoHref, telHref } from "./contactHref";
import { CopyButton } from "./CopyButton";
import styles from "./ProductDetail.module.css";

// The photo is half of the 760px dialog (or the full-page panel), full width once stacked.
const MEDIA_SIZES = "(max-width: 640px) 100vw, 380px";

export type ProductDetailProps = {
  product: ProductWithCategory;
  /** The category's position, which picks the placeholder tone. */
  toneIndex: number;
  settings: Pick<StoreSettings, "phone" | "email">;
  /** `h1` on the product page, `h2` in the dialog over the storefront. */
  headingLevel: "h1" | "h2";
  /** Id for the product name, so a dialog can be labelled by it. */
  titleId?: string;
  /** Shown at the end of the top row, e.g. the dialog's close button. */
  action?: ReactNode;
};

/** Product photo and details with how to ask about it. The dialog and the product page share it. */
export function ProductDetail({
  product,
  toneIndex,
  settings,
  headingLevel: Heading,
  titleId,
  action,
}: ProductDetailProps) {
  const { phone, email } = settings;
  const out = product.stockStatus === "out_of_stock";

  return (
    <div className={styles.detail}>
      <div
        className={cx(
          styles.media,
          toneStyles[toneForIndex(toneIndex)],
          out && styles.out,
        )}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            sizes={MEDIA_SIZES}
            className={styles.image}
          />
        ) : (
          <Icon name={product.category.icon} size={72} />
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.top}>
          <p className={cx(styles.category, "t-label-overline")}>
            {product.category.name}
          </p>
          {action && <div className={styles.action}>{action}</div>}
        </div>
        <Heading id={titleId} className="t-headline-small">
          {product.name}
        </Heading>
        <div className={styles.priceRow}>
          <span className={cx(styles.price, "t-title-large")}>
            {formatPeso(product.priceCentavos)}
          </span>
          <StockStatus status={product.stockStatus} />
        </div>
        {product.keySpec && (
          <p className={cx(styles.muted, "t-body-medium")}>{product.keySpec}</p>
        )}
        {product.description && (
          <p className={cx(styles.muted, styles.description, "t-body-medium")}>
            {product.description}
          </p>
        )}

        {(phone || email) && (
          <div className={styles.ask}>
            <p className={cx(styles.askTitle, "t-label-large")}>
              To order or ask about this item
            </p>
            <ul className={styles.askList}>
              {phone && (
                <AskRow
                  id="detail-phone"
                  icon="call"
                  label="Phone"
                  value={phone}
                  href={telHref(phone)}
                />
              )}
              {email && (
                <AskRow
                  id="detail-email"
                  icon="mail"
                  label="Email"
                  value={email}
                  href={mailtoHref(email)}
                />
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function AskRow({
  id,
  icon,
  label,
  value,
  href,
}: {
  id: string;
  icon: string;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <li className={styles.askRow}>
      <Icon name={icon} size={18} className={styles.askIcon} />
      <a id={id} href={href} className={cx(styles.askValue, "t-body-medium")}>
        {value}
      </a>
      <CopyButton value={value} label={label} targetId={id} />
    </li>
  );
}
