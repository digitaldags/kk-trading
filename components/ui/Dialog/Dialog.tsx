"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { IconButton } from "../IconButton";
import { cx } from "../shared/cx";
import styles from "./Dialog.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DialogProps = {
  open: boolean;
  /** Called on Escape, a scrim click or the close button. The parent sets `open` to false. */
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Buttons for the action row, right aligned. */
  actions?: ReactNode;
  /** Shows a close button in the header. */
  showClose?: boolean;
  /** `default` is 560px wide, `wide` is 760px. */
  size?: "default" | "wide";
  /** Fills the screen at 600px and below. Turn off for short confirmations. */
  fullScreenOnMobile?: boolean;
  className?: string;
};

/**
 * Modal dialog on the native `<dialog>` element. `showModal()` makes the rest of the page
 * inert, so focus stays inside. Focus returns to the trigger when it closes.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  showClose = true,
  size = "default",
  fullScreenOnMobile = true,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      initialFocusTarget(dialog, bodyRef.current)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  // Close if the dialog unmounts while open.
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  // Escape fires `cancel`. Keep the dialog open until the parent changes `open`.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  // The dialog element has no padding, so a click that targets it is a click on the scrim.
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose();
  }

  // The page behind is inert, but browsers let Tab move on to their own UI.
  // Wrap focus from the last control to the first (and back with Shift+Tab).
  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={cx(
        styles.dialog,
        size === "wide" && styles.wide,
        fullScreenOnMobile && styles.fullScreen,
        className,
      )}
      onCancel={handleCancel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {open && (
        <>
          <div className={styles.head}>
            <h2 id={titleId} className={cx(styles.title, "t-headline-small")}>
              {title}
            </h2>
            {showClose && (
              <IconButton
                icon="close"
                label="Close"
                className={styles.close}
                onClick={onClose}
              />
            )}
          </div>
          <div ref={bodyRef} className={cx(styles.body, "t-body-large")}>
            {children}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </>
      )}
    </dialog>
  );
}

/** An `autofocus` element, else the first focusable in the body, else the first focusable anywhere. */
function initialFocusTarget(
  dialog: HTMLDialogElement,
  body: HTMLElement | null,
): HTMLElement | null {
  return (
    dialog.querySelector<HTMLElement>("[autofocus]") ??
    body?.querySelector<HTMLElement>(FOCUSABLE) ??
    dialog.querySelector<HTMLElement>(FOCUSABLE)
  );
}
