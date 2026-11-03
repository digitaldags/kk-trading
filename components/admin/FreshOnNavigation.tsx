"use client";

import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";

/**
 * Remounts its children on each push or replace navigation (a link click,
 * `router.replace`), and keeps their state on browser Back and Forward.
 *
 * Under `cacheComponents`, Next hides a page you leave in React `<Activity>` and
 * shows the same instance again when you come back, `useState` included. Without
 * this, New quotation reopened the quotation just saved, and saving it updated
 * that one (BUG-01). See "Preserving UI state" in the Next docs (`bfcacheId`).
 */
export function FreshOnNavigation({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
