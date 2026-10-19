import { and, count, eq, gte, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { loginAttempts } from "@/lib/db/schema";
import type { LoginAttemptRepo } from "./types";

export function createLoginAttemptRepo(db: Db): LoginAttemptRepo {
  async function countFailures(match: SQL, since: Date) {
    const [row] = await db
      .select({ n: count() })
      .from(loginAttempts)
      .where(
        and(
          match,
          eq(loginAttempts.succeeded, false),
          gte(loginAttempts.createdAt, since),
        ),
      );
    return row?.n ?? 0;
  }

  return {
    async record({ email, ip, succeeded }) {
      await db
        .insert(loginAttempts)
        .values({ email: email.trim().toLowerCase(), ip, succeeded });
    },

    countFailuresByEmail(email, since) {
      return countFailures(
        eq(loginAttempts.email, email.trim().toLowerCase()),
        since,
      );
    },

    countFailuresByIp(ip, since) {
      return countFailures(eq(loginAttempts.ip, ip), since);
    },
  };
}
