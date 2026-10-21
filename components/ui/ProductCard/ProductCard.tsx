import Image from "next/image";
import Link from "next/link";
import type { StockStatus as Status } from "@/lib/domain/stock";
import { formatPeso } from "@/lib/format";
import { Icon } from "../Icon";
import { StockStatus } from "../StockStatus";
import { cx } from "../shared/cx";
import { toneForIndex } from "../shared/tone";
import toneStyles from "../shared/tone.module.css";
import styles from "./ProductCard.module.css";

// Card widths in the storefront grid (auto-fill, min 250px, 16px gap, 1168px max):
// 1 column below 548px, 2 below 814px, 3 below 1080px, then 4 columns of 280px.
const GRID_SIZES =
  "(max-width: 547px) calc(100vw - 32px), (max-width: 813px) calc(50vw - 24px), (max-width: 1079px) calc(33vw - 22px), 280px";

export type ProductCardProps = {
  name: string;
  /** Category name, shown as the overline. */
  category: string;
  /** Key spec line. */
  spec: string;
  priceCentavos: number;
  status: Status;
  imageUrl?: string | null;
  /** Category icon, shown when there's no photo. */
  icon: string;
  /** The category's position, which picks the placeholder tone. */
  toneIndex: number;
  /** Makes the whole card a link. */
  href?: string;
  /** `sizes` for the photo. Defaults to the storefront grid's 1 to 4 columns. */
  sizes?: string;
  /** Heading level for the product name. */
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
};

export function ProductCard({
  name,
  category,
  spec,
  priceCentavos,
  status,
  imageUrl,
  icon,
  toneIndex,
  href,
  sizes = GRID_SIZES,
  headingLevel: Heading = "h3",
  className,
}: ProductCardProps) {
  return (
    <article
      className={cx(
        styles.card,
        href && styles.clickable,
        status === "out_of_stock" && styles.out,
        className,
      )}
    >
      <div className={cx(styles.media, toneStyles[toneForIndex(toneIndex)])}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes={sizes}
            className={styles.image}
          />
        ) : (
          <Icon name={icon} size={72} />
        )}
      </div>
      <div className={styles.body}>
        <p className={cx(styles.category, "t-label-overline")}>{category}</p>
        <Heading className={cx(styles.name, "t-title-medium")}>
          {href ? (
            <Link href={href} className={styles.link}>
              {name}
            </Link>
          ) : (
            name
          )}
        </Heading>
        <p className={cx(styles.spec, "t-body-medium")}>{spec}</p>
        <div className={styles.footer}>
          <span className={cx(styles.price, "t-title-large")}>
            {formatPeso(priceCentavos)}
          </span>
          <StockStatus status={status} />
        </div>
      </div>
    </article>
  );
}
