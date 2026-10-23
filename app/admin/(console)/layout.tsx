import { AdminAppBar } from "@/components/admin/AdminAppBar";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { PublishBar } from "@/components/admin/PublishBar";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import { cx } from "@/components/ui/shared/cx";
import { getOptionalAdmin } from "@/lib/auth/requireAdmin";
import { publishService } from "@/lib/services";
import { signOut } from "../actions";
import { discardChanges, publish } from "./actions";
import styles from "./layout.module.css";

// The signed-in admin: app bar (with the publish status), section tabs, the Publish bar
// and one snackbar for every page. This isn't the auth check (layouts don't re-run on
// every navigation); each page and action calls `requireAdmin()` itself. The layout only
// reads the session to decide whether to show the status, and shows nothing more to a
// visitor without one. The sign-in page sits outside this group.
export default async function ConsoleLayout({
  children,
}: LayoutProps<"/admin">) {
  // The session cookie first, so the build never prerenders the status read.
  const admin = await getOptionalAdmin();
  const unpublished = admin
    ? (await publishService.status()).unpublished
    : undefined;

  return (
    <SnackbarProvider>
      <AdminAppBar signOut={signOut} unpublished={unpublished} />
      <main className={cx("wrap", styles.main)}>
        <AdminTabs />
        {children}
      </main>
      {unpublished && (
        <PublishBar publishAction={publish} discardAction={discardChanges} />
      )}
    </SnackbarProvider>
  );
}
