import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/shared/cx";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { signOut } from "./actions";
import styles from "./page.module.css";

// Reads the session cookie, so it renders per request and blocks until it's checked.
export const instant = false;

export const metadata: Metadata = { title: "Admin" };

/** Placeholder until ticket 09 builds the admin shell and products list. */
export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main className={styles.main}>
      <div className={styles.panel}>
        <h1 className="t-headline-medium">Store admin</h1>
        <p className={cx(styles.lead, "t-body-medium")}>
          Signed in as {admin.email}.
        </p>
        <div className={styles.actions}>
          <form action={signOut}>
            <Button type="submit" variant="outlined" icon="logout">
              Sign out
            </Button>
          </form>
          <Button variant="text" href="/">
            View store
          </Button>
        </div>
      </div>
    </main>
  );
}
