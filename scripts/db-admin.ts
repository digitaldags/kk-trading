import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { describeError, loadDatabaseUrl } from "@/lib/db/env";
import { MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/db/seed";
import { createAdminUserRepo } from "@/lib/repositories/adminUserRepo";
import { hashPassword } from "@/lib/services/passwords";

const USAGE =
  "Usage: pnpm db:admin --email <email> --password <password> [--allow-weak-password] [--env-file <path>]";

/**
 * Creates an admin, or sets a new password for an existing one. A new password signs out
 * that admin's other sessions. This is also how the owner resets a forgotten password
 * until reset by email exists.
 */
async function main() {
  const argv = process.argv.slice(2);
  const email = option(argv, "--email")?.trim();
  const password = option(argv, "--password");
  const allowWeak = argv.includes("--allow-weak-password");
  if (!email || !password) fail(USAGE);

  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    if (!allowWeak) {
      fail(
        `Use a password of at least ${MIN_ADMIN_PASSWORD_LENGTH} characters, or pass --allow-weak-password for a test account.`,
      );
    }
    console.warn(
      "Warning: weak password. Anyone who guesses it can edit the store. Replace it before launch.",
    );
  }

  const db = drizzle({ client: neon(loadDatabaseUrl(argv)) });
  const admins = createAdminUserRepo(db);
  const passwordHash = await hashPassword(password);
  const existing = await admins.findByEmail(email);

  if (existing) {
    await admins.updatePassword(existing.id, passwordHash);
    console.log(
      `Set a new password for ${existing.email}. Its other sessions are signed out.`,
    );
  } else {
    const added = await admins.insert({ email, passwordHash });
    console.log(`Added admin ${added.email}.`);
  }
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main().catch((error: unknown) => {
  // Only the message: never the env, the query parameters or the password.
  console.error(describeError(error));
  process.exit(1);
});
