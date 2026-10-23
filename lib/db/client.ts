import { neon } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

/** Any Postgres database Drizzle can drive: Neon over HTTP in the app, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT>;

let db: NeonHttpDatabase | undefined;

/** The app's database. Connects on first use, so builds and tests don't need `DATABASE_URL`. */
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. See README › Database.");
    }
    db = drizzle({ client: neon(url) });
  }
  return db;
}
