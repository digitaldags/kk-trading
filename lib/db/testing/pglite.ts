import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "../client";
import { seed } from "../seed";

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
