import { neon } from "@neondatabase/serverless";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { describeError, loadDatabaseUrl } from "@/lib/db/env";
import { adminUsers } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";

// Loads the prototype content and the first admin. Safe to run again: existing rows are skipped.
async function main() {
  const db = drizzle({ client: neon(loadDatabaseUrl()) });
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  const admin = email && password ? { email, password } : undefined;

  const inserted = await seed(db, admin);
  console.log(
    `Inserted ${inserted.settings} settings row, ${inserted.categories} categories, ` +
      `${inserted.products} products and ${inserted.admins} admin.`,
  );

  if (!admin) {
    const [row] = await db.select({ n: count() }).from(adminUsers);
    if (!row?.n) {
      console.error(
        "No admin exists yet. Set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD, then run the seed again.",
      );
      process.exit(1);
    }
  }
}

main().catch((error: unknown) => {
  // Only the message: never the env, the query parameters or the password.
  console.error(describeError(error));
  process.exit(1);
});
