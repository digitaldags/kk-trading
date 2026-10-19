import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { describeError, loadDatabaseUrl } from "@/lib/db/env";

// Applies the SQL migrations in drizzle/ that haven't run yet.
// Uses Neon's WebSocket driver (not HTTP like the app) so all pending migrations run in one transaction.
async function main() {
  const pool = new Pool({ connectionString: loadDatabaseUrl() });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
    console.log("Migrations are up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
