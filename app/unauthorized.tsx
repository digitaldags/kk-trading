import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/shared/cx";
import styles from "./status-page.module.css";

// Rendered with a 401 when `requireAdmin()` finds no valid session, e.g. after the
// password changed on another device. Reads nothing from the database.
export default function Unauthorized() {
  return (
    <main className={styles.main}>
      <div className={styles.panel}>
        <Icon name="lock" size={40} />
        <h1 className="t-headline-medium">Sign in to continue</h1>
        <p className={cx(styles.lead, "t-body-large")}>
          Your session ended. Sign in again to manage the store.
        </p>
        <Button href="/admin/login" prefetch={false}>
          Sign in
        </Button>
      </div>
    </main>
  );
}
