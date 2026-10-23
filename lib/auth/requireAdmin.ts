import { cookies } from "next/headers";
import { cache } from "react";
import { unauthorized } from "next/navigation";
import type { AdminSession } from "@/lib/domain/types";
import { authService } from "@/lib/services";
import { SESSION_COOKIE, verifySession } from "./session";

/**
 * The signed-in admin, or null. Checks the cookie's signature and expiry, that the admin
 * still exists, and that their password hasn't changed since the session was issued.
 * Once per request: the admin layout and the page both ask.
 */
export const getOptionalAdmin = cache(
  async (): Promise<AdminSession | null> => {
    const store = await cookies();
    const session = await verifySession(store.get(SESSION_COOKIE)?.value);
    if (!session) return null;
    return authService.getSessionAdmin(session);
  },
);

/**
 * The real protection for admin pages and server actions: call it first in every one.
 * Without a valid session it calls `unauthorized()`, which answers 401 and renders
 * app/unauthorized.tsx. proxy.ts only redirects signed-out visitors as a convenience.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getOptionalAdmin();
  if (!admin) unauthorized();
  return admin;
}
