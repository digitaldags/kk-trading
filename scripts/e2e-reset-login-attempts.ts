import { neon } from "@neondatabase/serverless";
import { and, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { describeError, loadDatabaseUrl } from "@/lib/db/env";
import { loginAttempts } from "@/lib/db/schema";

// Deletes the failed sign-in attempts the e2e specs make: made-up emails at `example.test`
// (a reserved domain no real account can have), and the test account's own failures
// (e2e/admin-settings.spec.ts enters a wrong current password). Each run fails the same
// way, so without this the 6th run within 15 minutes hits an email's limit of 5. The
// failures also count towards the local IP's limit of 20. Run by the admin specs before
// they start.
async function main() {
  const db = drizzle({ client: neon(loadDatabaseUrl()) });
  const testAccount = process.env.E2E_ADMIN_EMAIL?.trim().toLowerCase();
  const deleted = await db
    .delete(loginAttempts)
    .where(
      or(
        like(loginAttempts.email, "%@example.test"),
        testAccount
          ? and(
              eq(loginAttempts.email, testAccount),
              eq(loginAttempts.succeeded, false),
            )
          : undefined,
      ),
    )
    .returning({ id: loginAttempts.id });
  console.log(`Deleted ${deleted.length} e2e sign-in attempts.`);
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
