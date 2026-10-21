import { AdminAppBar } from "@/components/admin/AdminAppBar";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import { cx } from "@/components/ui/shared/cx";
import { signOut } from "../actions";
import styles from "./layout.module.css";

// The signed-in admin: app bar, section tabs and one snackbar for every page. No auth
// check here (layouts don't re-run on every navigation); each page and action calls
// `requireAdmin()` itself. The sign-in page sits outside this group.
export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <SnackbarProvider>
      <AdminAppBar signOut={signOut} />
      <main className={cx("wrap", styles.main)}>
        <AdminTabs />
        {children}
      </main>
    </SnackbarProvider>
  );
}
