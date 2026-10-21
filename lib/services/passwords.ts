import { hash, verify } from "@node-rs/argon2";
import type { PasswordVerifier } from "./authService";

// argon2id with @node-rs/argon2's defaults (m=19456, t=2, p=1), as `pnpm db:seed` and
// `pnpm db:admin` hash passwords.

/** The argon2id hash of a random string nobody knows, with the same cost as real hashes. */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$zca2NLqrU+h46ULALw1+nw$9dS7BW9an83nt3EaoCGYWqXOAe6J0NFwBeTBeLMeKjo";

export const argon2Passwords: PasswordVerifier = {
  async verify(passwordHash, password) {
    try {
      return await verify(passwordHash, password);
    } catch {
      // A malformed stored hash never matches.
      return false;
    }
  },
  dummyHash: DUMMY_HASH,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}
