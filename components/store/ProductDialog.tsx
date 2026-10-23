"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";

const CloseContext = createContext<() => void>(() => {});

/**
 * Closing a route dialog goes back to the storefront, which is still mounted behind it,
 * so its scroll position and filters stay as they were. Guarded so a second Escape
 * before the route changes can't go back twice.
 */
function useCloseRoute() {
  const router = useRouter();
  const closing = useRef(false);

  // Next.js keeps a left route's tree alive but hidden, and shows the same instance
  // again when that product is reopened. Effects run again then, refs don't reset, so
  // without this the guard would still be set and every later close would do nothing.
  useEffect(() => {
    closing.current = false;
  }, []);

  return useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    router.back();
  }, [router]);
}

/** The product detail over the storefront, opened from a product card. */
export function ProductDialog({
  titleId,
  children,
}: {
  /** Id of the product name inside `children`. */
  titleId: string;
  children: ReactNode;
}) {
  const close = useCloseRoute();
  return (
    <CloseContext.Provider value={close}>
      <Dialog open onClose={close} labelledBy={titleId} size="wide">
        {children}
      </Dialog>
    </CloseContext.Provider>
  );
}

/** The close button inside `ProductDialog`'s content. */
export function ProductDialogClose() {
  const close = useContext(CloseContext);
  return <IconButton icon="close" label="Close" onClick={close} />;
}

/** Shown when a card's product was removed after the storefront rendered. */
export function MissingProductDialog() {
  const close = useCloseRoute();
  return (
    <Dialog open onClose={close} title="This product is no longer listed">
      <p>It was removed from the catalog.</p>
    </Dialog>
  );
}
