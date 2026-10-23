"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useSnackbar } from "@/components/ui/Snackbar";
import { cx } from "@/components/ui/shared/cx";
import type { PublishAction } from "./actionTypes";
import styles from "./PublishBar.module.css";

type PublishBarProps = {
  publishAction: PublishAction;
  discardAction: PublishAction;
};

/**
 * The bar at the bottom while there are unpublished changes (Figma 12:501): Publish
 * makes the draft live, Discard (after a confirm) puts it back to what's live. The
 * console layout shows it only when the draft differs.
 */
export function PublishBar({ publishAction, discardAction }: PublishBarProps) {
  const snackbar = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(action: PublishAction) {
    startTransition(async () => {
      const result = await action();
      setConfirming(false);
      snackbar.show(result.message);
    });
  }

  return (
    <>
      <div
        className={styles.bar}
        role="region"
        aria-label="Unpublished changes"
        aria-busy={pending || undefined}
      >
        <p className={cx(styles.message, "t-body-medium")}>
          You have changes that aren&apos;t live yet.
        </p>
        <Button
          variant="text"
          className={styles.discard}
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          Discard
        </Button>
        <Button
          icon="publish"
          className={styles.publish}
          disabled={pending}
          onClick={() => run(publishAction)}
        >
          Publish
        </Button>
      </div>

      <Dialog
        open={confirming}
        onClose={() => {
          if (!pending) setConfirming(false);
        }}
        title="Discard unpublished changes?"
        showClose={false}
        fullScreenOnMobile={false}
        actions={
          <>
            <Button
              variant="text"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Keep changes
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => run(discardAction)}
            >
              Discard changes
            </Button>
          </>
        }
      >
        <p className={styles.dialogText}>
          The store goes back to what was last published. Products, categories
          and photos added since then are removed.
        </p>
      </Dialog>
    </>
  );
}
