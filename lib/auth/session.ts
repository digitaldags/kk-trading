import { jwtVerify, SignJWT } from "jose";
import type { SessionClaims } from "@/lib/services/authService";

// The admin session: an HS256 JWT in an httpOnly cookie. `sub` is the admin id and `pwd`
// is their `password_changed_at` (epoch ms) when it was issued; `requireAdmin()` rejects
// it once the password changes. No database here: proxy.ts imports this module.

export const SESSION_COOKIE = "kk_admin_session";

/** Sessions last 7 days from their last refresh. */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** proxy.ts re-issues a session older than this, so an admin who keeps using it stays in. */
export const SESSION_REFRESH_AFTER_SECONDS = 24 * 60 * 60;

const MIN_SECRET_BYTES = 32;
const ALGORITHM = "HS256";

export type Session = SessionClaims & {
  /** Issued at, in epoch seconds. */
  iat: number;
};

/** Read on first use, so building the app never needs the secret. */
function getSecret(): Uint8Array {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
  if (secret.byteLength < MIN_SECRET_BYTES) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SECRET_BYTES} bytes. Generate one with \`openssl rand -base64 32\`.`,
    );
  }
  return secret;
}

export async function signSession({
  sub,
  pwd,
}: SessionClaims): Promise<string> {
  return new SignJWT({ pwd })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/** The session in a token, or null if it's missing, tampered with, expired or malformed. */
export async function verifySession(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
    });
    const { sub, pwd, iat } = payload;
    if (typeof sub !== "string" || typeof pwd !== "number") return null;
    if (typeof iat !== "number") return null;
    return { sub, pwd, iat };
  } catch {
    return null;
  }
}

/** Shared by the sign-in action and proxy.ts. */
export const sessionCookieOptions = {
  httpOnly: true,
  // Browsers accept Secure cookies on http://localhost, so this holds in development too.
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;
