import {
  fieldError,
  formError,
  fromZodError,
  ok,
  type ServiceResult,
} from "@/lib/domain/result";
import {
  isId,
  LOGIN_WINDOW_MS,
  MAX_FAILURES_PER_EMAIL,
  MAX_FAILURES_PER_IP,
  passwordChangeSchema,
  signInSchema,
  type PasswordChangeInput,
  type SignInInput,
} from "@/lib/domain/schemas";
import type { AdminSession } from "@/lib/domain/types";
import type { AdminUserRepo, LoginAttemptRepo } from "@/lib/repositories/types";

export const WRONG_CREDENTIALS = "That email and password don't match.";
export const TOO_MANY_ATTEMPTS = "Too many attempts. Try again in 15 minutes.";
export const WRONG_CURRENT_PASSWORD = "Your current password isn't right.";
const SESSION_GONE = "Your account no longer exists. Sign in again.";

export type PasswordVerifier = {
  /** Constant-time check of `password` against an argon2 `hash`. */
  verify(hash: string, password: string): Promise<boolean>;
  /** A valid hash that matches no real password, checked when the email is unknown. */
  dummyHash: string;
  /** Hashes a new password. */
  hash(password: string): Promise<string>;
};

/** What a session token carries: the admin id and when their password last changed. */
export type SessionClaims = { sub: string; pwd: number };

export function createAuthService(deps: {
  admins: AdminUserRepo;
  attempts: LoginAttemptRepo;
  passwords: PasswordVerifier;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  /** Whether the email or the IP has too many recent failures to try a password at all. */
  async function isRateLimited(email: string, ip: string) {
    const since = new Date(now().getTime() - LOGIN_WINDOW_MS);
    const [byEmail, byIp] = await Promise.all([
      deps.attempts.countFailuresByEmail(email, since),
      deps.attempts.countFailuresByIp(ip, since),
    ]);
    return byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP;
  }

  return {
    /**
     * Checks an email and password, rate-limited by `login_attempts`. Too many recent
     * failures for the email or the IP reject the attempt before the password is checked,
     * so even a correct password is turned away. Unknown emails and wrong passwords get
     * the same error, after the same argon2 check.
     */
    async signIn(
      input: SignInInput,
      ip: string,
    ): Promise<ServiceResult<SessionClaims, keyof SignInInput>> {
      const parsed = signInSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      const { email, password } = parsed.data;

      // Blocked attempts aren't recorded, so a lockout ends 15 minutes after the last
      // real failure instead of extending itself.
      if (await isRateLimited(email, ip)) return formError(TOO_MANY_ATTEMPTS);

      const admin = await deps.admins.findByEmail(email);
      const matches = await deps.passwords.verify(
        admin?.passwordHash ?? deps.passwords.dummyHash,
        password,
      );
      const succeeded = Boolean(admin) && matches;
      await deps.attempts.record({ email, ip, succeeded });

      if (!admin || !succeeded) return formError(WRONG_CREDENTIALS);
      return ok({ sub: admin.id, pwd: admin.passwordChangedAt.getTime() });
    },

    /**
     * The admin a verified session token belongs to, or null if they no longer exist or
     * changed their password after the token was issued.
     */
    async getSessionAdmin({
      sub,
      pwd,
    }: SessionClaims): Promise<AdminSession | null> {
      if (!isId(sub)) return null;
      const admin = await deps.admins.findById(sub);
      if (!admin) return null;
      if (admin.passwordChangedAt.getTime() > pwd) return null;
      return { id: admin.id, email: admin.email };
    },

    /**
     * The signed-in admin changes their own password. The current password is checked
     * like a sign-in (same rate limit, and a wrong one counts as a failure), so a session
     * left open can't be used to guess it. Setting the new one moves `passwordChangedAt`
     * forward, which signs out every other session; the caller re-issues this one from
     * the returned claims.
     */
    async changePassword(
      adminId: string,
      input: PasswordChangeInput,
      ip: string,
    ): Promise<ServiceResult<SessionClaims, keyof PasswordChangeInput>> {
      const parsed = passwordChangeSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      const { currentPassword, newPassword } = parsed.data;

      const admin = isId(adminId) ? await deps.admins.findById(adminId) : null;
      if (!admin) return formError(SESSION_GONE);

      if (await isRateLimited(admin.email, ip)) {
        return formError(TOO_MANY_ATTEMPTS);
      }
      const matches = await deps.passwords.verify(
        admin.passwordHash,
        currentPassword,
      );
      if (!matches) {
        await deps.attempts.record({
          email: admin.email,
          ip,
          succeeded: false,
        });
        return fieldError("currentPassword", WRONG_CURRENT_PASSWORD);
      }

      const updated = await deps.admins.updatePassword(
        admin.id,
        await deps.passwords.hash(newPassword),
      );
      if (!updated) return formError(SESSION_GONE);
      return ok({ sub: updated.id, pwd: updated.passwordChangedAt.getTime() });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
