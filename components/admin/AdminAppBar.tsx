import { ScrollShadow } from "@/components/store/ScrollShadow";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { cx } from "@/components/ui/shared/cx";
import styles from "./AdminAppBar.module.css";

type AdminAppBarProps = {
  /** The sign-out server action. */
  signOut: () => Promise<void>;
  /** Whether the draft differs from the live store. Undefined hides the status (signed out). */
  unpublished?: boolean;
};

/**
 * Admin app bar (Figma 12:301): back to the store, the title, the publish status
 * ("Unpublished changes" or "All changes live", 12:968), and Sign out.
 */
export function AdminAppBar({ signOut, unpublished }: AdminAppBarProps) {
  return (
    <ScrollShadow className={styles.appBar}>
      <div className={cx("wrap", styles.inner)}>
        <IconButton
          href="/"
          prefetch={false}
          icon="arrow_back"
          label="Back to store"
        />
        <span className={cx(styles.title, "t-title-brand")}>Store admin</span>
        {unpublished !== undefined && (
          <span
            className={cx(
              styles.status,
              unpublished ? styles.unpublished : styles.live,
              "t-label-medium",
            )}
          >
            <Icon name={unpublished ? "edit_note" : "cloud_done"} size={18} />
            <span className={styles.statusText}>
              {unpublished ? "Unpublished changes" : "All changes live"}
            </span>
          </span>
        )}
        <form action={signOut}>
          <Button type="submit" variant="text">
            Sign out
          </Button>
        </form>
      </div>
    </ScrollShadow>
  );
}
