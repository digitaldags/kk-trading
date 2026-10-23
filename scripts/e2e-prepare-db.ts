import { neon } from "@neondatabase/serverless";
import { describeError } from "@/lib/db/env";

// CI only (ticket 14): empties the Neon branch the workflow just made for this run, so
// `pnpm db:migrate` and `pnpm db:seed` can build it from scratch. The branch is
// schema-only (no production data), but it has the tables without drizzle's migration
// journal, so the migrations can't run on it as it is.
//
// It drops everything, so it refuses unless all three hold:
// - it's running in CI (CI=true),
// - it was asked with --reset-ci-branch,
// - DATABASE_URL's host is E2E_EXPECTED_DB_HOST, the host of the branch the workflow
//   created (the create-branch action's db_host output).

const FLAG = "--reset-ci-branch";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  if (process.env.CI !== "true") fail("Refusing: this only runs in CI.");
  if (!process.argv.includes(FLAG)) fail(`Refusing: pass ${FLAG}.`);

  const url = process.env.DATABASE_URL;
  const expected = process.env.E2E_EXPECTED_DB_HOST?.trim();
  if (!url || !expected) {
    fail("Refusing: DATABASE_URL and E2E_EXPECTED_DB_HOST must both be set.");
  }
  const host = new URL(url).hostname;
  if (host !== expected) {
    fail(
      `Refusing: DATABASE_URL points at ${host}, not the CI branch ${expected}.`,
    );
  }

  console.log(`Emptying the CI branch at ${host}`);
  const sql = neon(url);
  await sql`drop schema if exists drizzle cascade`;
  await sql`drop schema public cascade`;
  await sql`create schema public`;
  console.log("Emptied. Run pnpm db:migrate, then pnpm db:seed.");
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
