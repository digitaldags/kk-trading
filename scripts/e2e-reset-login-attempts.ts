import { neon } from "@neondatabase/serverless";
import { like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { describeError, loadDatabaseUrl } from "@/lib/db/env";
import { loginAttempts } from "@/lib/db/schema";

// Deletes the sign-in attempts the e2e specs make with made-up emails at `example.test`
// (a reserved domain no real account can have). Each run fails once with the same test
// email, so without this the 6th run within 15 minutes hits that email's limit of 5. The
// failures also count towards the local IP's limit of 20. Run by e2e/admin-auth.spec.ts
// before it starts.
async function main() {
  const db = drizzle({ client: neon(loadDatabaseUrl()) });
  const deleted = await db
    .delete(loginAttempts)
    .where(like(loginAttempts.email, "%@example.test"))
    .returning({ id: loginAttempts.id });
  console.log(`Deleted ${deleted.length} e2e sign-in attempts.`);
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
