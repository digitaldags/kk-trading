import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/shared/cx";
import { toneForIndex } from "@/components/ui/shared/tone";
import toneStyles from "@/components/ui/shared/tone.module.css";
import type { CategoryWithCount, StoreSettings } from "@/lib/domain/types";
import { categoryHref, countLabel } from "./catalogUrl";
import styles from "./Hero.module.css";

type HeroProps = {
  settings: Pick<StoreSettings, "name" | "headline" | "tagline">;
  categories: CategoryWithCount[];
  totalProducts: number;
};

export function Hero({ settings, categories, totalProducts }: HeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={cx("wrap", styles.grid)}>
        <div className={styles.copy}>
          <p className={cx(styles.eyebrow, "t-label-overline")}>
            {settings.name}
          </p>
          <h1 id="hero-title" className="t-display-hero-fluid">
            {settings.headline}
          </h1>
          {settings.tagline && (
            <p className={cx(styles.tagline, "t-body-hero")}>
              {settings.tagline}
            </p>
          )}
          <div className={styles.actions}>
            <Button variant="inverse" icon="grid_view" href="#catalog">
              Browse products
            </Button>
            <Button
              variant="outlined"
              icon="call"
              href="#contact"
              className={styles.outlined}
            >
              Ask about an item
            </Button>
          </div>
          <ul className={cx(styles.facts, "t-body-medium")}>
            <li>
              <Icon name="inventory_2" size={18} />
              {countLabel(totalProducts, "product", "products")}
            </li>
            <li>
              <Icon name="payments" size={18} />
              Prices in Philippine pesos
            </li>
          </ul>
        </div>

        {categories.length > 0 && (
          <ul className={styles.tiles}>
            {categories.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={categoryHref(c.slug)}
                  className={cx(styles.tile, toneStyles[toneForIndex(i)])}
                >
                  <span className={styles.avatar}>
                    <Icon name={c.icon} size={34} />
                  </span>
                  <span className={styles.tileText}>
                    <span className="t-title-large">{c.name}</span>
                    {c.blurb && (
                      <span className={cx(styles.blurb, "t-body-medium")}>
                        {c.blurb}
                      </span>
                    )}
                    <span className={cx(styles.count, "t-label-medium")}>
                      {countLabel(c.productCount, "item", "items")}
                      <Icon name="arrow_forward" size={18} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
