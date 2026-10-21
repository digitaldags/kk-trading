import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/shared/cx";
import styles from "./not-found.module.css";

// Prerendered at build time, so it reads nothing from the database.
export default function NotFound() {
  return (
    <main className={styles.main}>
      <div className={styles.panel}>
        <Icon name="search_off" size={40} />
        <h1 className="t-headline-medium">Page not found</h1>
        <p className={cx(styles.lead, "t-body-large")}>
          The product may have been removed, or the link may be mistyped.
        </p>
        <Button icon="arrow_back" href="/#catalog">
          Back to all products
        </Button>
      </div>
    </main>
  );
}
