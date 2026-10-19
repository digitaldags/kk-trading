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
            sizes="(max-width: 640px) 100vw, 280px"
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
