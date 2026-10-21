import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { cx } from "@/components/ui/shared/cx";
import type { Category } from "@/lib/domain/types";
import styles from "./AppBar.module.css";
import { categoryHref } from "./catalogUrl";
import { ScrollShadow } from "./ScrollShadow";

type AppBarProps = {
  storeName: string;
  categories: Pick<Category, "id" | "slug" | "name">[];
};

export function AppBar({ storeName, categories }: AppBarProps) {
  return (
    <ScrollShadow className={styles.appBar}>
      <div className={cx("wrap", styles.inner)}>
        <a
          href="#top"
          className={styles.brand}
          aria-label={`${storeName}, back to top`}
        >
          <span className={styles.mark}>
            <Icon name="storefront" />
          </span>
          <span className={cx(styles.name, "t-title-brand")}>{storeName}</span>
        </a>
        <nav aria-label="Sections" className={styles.nav}>
          {categories.map((c) => (
            <Button key={c.id} variant="text" href={categoryHref(c.slug)}>
              {c.name}
            </Button>
          ))}
          <Button variant="text" href="#contact">
            Contact
          </Button>
        </nav>
        <IconButton
          href="/admin"
          prefetch={false}
          icon="manage_accounts"
          label="Admin"
        />
      </div>
    </ScrollShadow>
  );
}
