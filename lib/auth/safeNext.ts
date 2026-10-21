export const ADMIN_HOME = "/admin";
export const LOGIN_PATH = "/admin/login";

/**
 * Where to go after signing in. `next` comes from the URL, so it's only followed when it's
 * an admin path on this site (never another origin, never back to the login page).
 */
export function safeAdminPath(next: unknown): string {
  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//")
  ) {
    return ADMIN_HOME;
  }
  let url: URL;
  try {
    url = new URL(next, "http://localhost");
  } catch {
    return ADMIN_HOME;
  }
  const isAdmin =
    url.pathname === ADMIN_HOME || url.pathname.startsWith(`${ADMIN_HOME}/`);
  const isLogin =
    url.pathname === LOGIN_PATH || url.pathname.startsWith(`${LOGIN_PATH}/`);
  if (url.origin !== "http://localhost" || !isAdmin || isLogin)
    return ADMIN_HOME;
  return url.pathname + url.search;
}
