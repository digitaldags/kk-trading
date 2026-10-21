import {
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
  signInSchema,
  type SignInInput,
} from "@/lib/domain/schemas";
import type { AdminSession } from "@/lib/domain/types";
import type { AdminUserRepo, LoginAttemptRepo } from "@/lib/repositories/types";

export const WRONG_CREDENTIALS = "That email and password don't match.";
export const TOO_MANY_ATTEMPTS = "Too many attempts. Try again in 15 minutes.";

export type PasswordVerifier = {
  /** Constant-time check of `password` against an argon2 `hash`. */
  verify(hash: string, password: string): Promise<boolean>;
  /** A valid hash that matches no real password, checked when the email is unknown. */
  dummyHash: string;
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

      const since = new Date(now().getTime() - LOGIN_WINDOW_MS);
      const [byEmail, byIp] = await Promise.all([
        deps.attempts.countFailuresByEmail(email, since),
        deps.attempts.countFailuresByIp(ip, since),
      ]);
      // Blocked attempts aren't recorded, so a lockout ends 15 minutes after the last
      // real failure instead of extending itself.
      if (byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP) {
        return formError(TOO_MANY_ATTEMPTS);
      }

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
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
