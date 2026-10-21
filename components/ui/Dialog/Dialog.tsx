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
import { SnackbarRegion } from "../Snackbar";
import styles from "./Dialog.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DialogBaseProps = {
  open: boolean;
  /** Called on Escape, a scrim click or the close button. The parent sets `open` to false. */
  onClose: () => void;
  children: ReactNode;
  /** `default` is 560px wide, `wide` is 760px. */
  size?: "default" | "wide";
  /** Fills the screen at 600px and below. Turn off for short confirmations. */
  fullScreenOnMobile?: boolean;
  className?: string;
};

type TitledDialogProps = DialogBaseProps & {
  title: ReactNode;
  labelledBy?: never;
  /** Buttons for the action row, right aligned. */
  actions?: ReactNode;
  /** Shows a close button in the header. */
  showClose?: boolean;
};

/** No header, padding or action row: the children lay out the whole dialog. */
type BareDialogProps = DialogBaseProps & {
  title?: never;
  /** Id of the heading inside the children that names the dialog. */
  labelledBy: string;
  actions?: never;
  showClose?: never;
};

export type DialogProps = TitledDialogProps | BareDialogProps;

/**
 * Modal dialog on the native `<dialog>` element. `showModal()` makes the rest of the page
 * inert, so focus stays inside. Focus returns to the trigger when it closes or unmounts.
 */
export function Dialog({
  open,
  onClose,
  title,
  labelledBy,
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
  // Set while this component closes the dialog, so its `close` event isn't taken for
  // the browser closing it.
  const closingRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      closingRef.current = false;
      dialog.showModal();
      initialFocusTarget(dialog, bodyRef.current)?.focus();
    } else if (!open && dialog.open) {
      closingRef.current = true;
      dialog.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  // Close if the dialog unmounts (or is hidden) while open, e.g. a route dialog left
  // with the Back button.
  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus = returnFocusRef;
    const closing = closingRef;
    return () => {
      if (!dialog?.open) return;
      closing.current = true;
      dialog.close();
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      returnFocus.current = null;
    };
  }, []);

  // Escape fires `cancel`. Keep the dialog open until the parent changes `open`.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  // The browser can close a modal dialog itself: Chrome does on a second Escape when the
  // page prevented the first without a click in between. Treat that as a close request,
  // so the parent (or a route dialog's URL) never stays open behind a closed dialog.
  function handleClose() {
    // `close` fires a task after `close()`. If the dialog has been shown again since
    // (React's dev double effect does close-then-show), the event is stale.
    if (dialogRef.current?.open) return;
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    if (!open) return;
    if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    returnFocusRef.current = null;
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
      aria-labelledby={labelledBy ?? titleId}
      className={cx(
        styles.dialog,
        size === "wide" && styles.wide,
        fullScreenOnMobile && styles.fullScreen,
        className,
      )}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {open && labelledBy !== undefined && (
        <div className={styles.bare}>{children}</div>
      )}
      {open && labelledBy === undefined && (
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
      {open && <SnackbarRegion />}
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
