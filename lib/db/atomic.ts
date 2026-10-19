import type { Db } from "./client";

type Query = PromiseLike<unknown>;

/**
 * Runs queries in one transaction. Neon's HTTP driver has no interactive transactions,
 * so it uses `batch()`, which Neon runs as a single transaction. Other drivers (PGlite in
 * tests) use `transaction()`. `build` receives the handle the queries must be built on.
 */
export async function atomic(
  db: Db,
  build: (q: Db) => [Query, ...Query[]],
): Promise<void> {
  if (hasBatch(db)) {
    await db.batch(build(db));
    return;
  }
  await db.transaction(async (tx) => {
    for (const query of build(tx)) await query;
  });
}

function hasBatch(
  db: Db,
): db is Db & { batch: (queries: Query[]) => Promise<unknown> } {
  return typeof (db as { batch?: unknown }).batch === "function";
}
