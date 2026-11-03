import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "../client";
import { seed } from "../seed";

type Journal = { entries: { tag: string }[] };

/**
 * A fresh in-memory Postgres migrated only up to `lastTag` (e.g. "0001_published_snapshot"),
 * for testing what a later migration does to existing data. Run the next one with
 * `runMigrationSql`.
 */
export async function createTestDbAt(
  lastTag: string,
): Promise<{ db: Db; client: PGlite }> {
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as Journal;
  const last = journal.entries.findIndex((e) => e.tag === lastTag);
  if (last < 0) throw new Error(`No migration ${lastTag}.`);

  const folder = mkdtempSync(join(tmpdir(), "kk-migrations-"));
  try {
    cpSync("drizzle", folder, { recursive: true });
    writeFileSync(
      join(folder, "meta", "_journal.json"),
      JSON.stringify({
        ...journal,
        entries: journal.entries.slice(0, last + 1),
      }),
    );
    const client = new PGlite();
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: folder });
    return { db, client };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** Runs one migration file's statements as `pnpm db:migrate` would, in order. */
export async function runMigrationSql(client: PGlite, tag: string) {
  const statements = readFileSync(join("drizzle", `${tag}.sql`), "utf8").split(
    "--> statement-breakpoint",
  );
  for (const statement of statements) {
    if (statement.trim()) await client.exec(statement);
  }
}

export const TEST_ADMIN = {
  email: "owner@example.com",
  password: "correct horse battery staple",
};

/** A fresh in-memory Postgres with the drizzle/ migrations applied. */
export async function createTestDb(): Promise<{ db: Db; client: PGlite }> {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db, client };
}

/** A test database with the seed loaded. */
export async function createSeededTestDb() {
  const test = await createTestDb();
  await seed(test.db, TEST_ADMIN);
  return test;
}
