import { ScrollShadow } from "@/components/store/ScrollShadow";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cx } from "@/components/ui/shared/cx";
import styles from "./AdminAppBar.module.css";

type AdminAppBarProps = {
  /** The sign-out server action. */
  signOut: () => Promise<void>;
};

/** Admin app bar (Figma 12:301): back to the store, the title, and Sign out. */
export function AdminAppBar({ signOut }: AdminAppBarProps) {
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
        <form action={signOut}>
          <Button type="submit" variant="text">
            Sign out
          </Button>
        </form>
      </div>
    </ScrollShadow>
  );
}
