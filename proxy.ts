import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH } from "@/lib/auth/safeNext";
import {
  SESSION_COOKIE,
  SESSION_REFRESH_AFTER_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "@/lib/auth/session";

/**
 * A convenience in front of /admin: signed-out visitors go to the login page instead of a
 * 401, and a session in use is refreshed so it lasts 7 days from the last visit. It only
 * checks the token's signature. `requireAdmin()` in every admin page and action is the real
 * protection (it also checks the admin still exists and hasn't changed their password).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (!session) {
    // Only page visits are redirected. Server actions (POST) go through, so
    // `requireAdmin()` answers them with a 401 instead of a redirect to a form.
    const isVisit = request.method === "GET" || request.method === "HEAD";
    if (pathname === LOGIN_PATH || !isVisit) return NextResponse.next();
    const login = new URL(LOGIN_PATH, request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();
  const age = Math.floor(Date.now() / 1000) - session.iat;
  if (age > SESSION_REFRESH_AFTER_SECONDS) {
    const token = await signSession({ sub: session.sub, pwd: session.pwd });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  }
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
