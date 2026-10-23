import { sql, type SQL } from "drizzle-orm";
import type { Db } from "./client";

// The SQL behind Publish (ticket 15), shared by the publish repository and the seed. The
// storefront reads only `published_snapshot.data`: categories, products and settings as
// Postgres's `to_jsonb(row)`, so the snake_case column names, with rows ordered by id.
// drizzle/0001_published_snapshot.sql makes the first snapshot the same way.

/**
 * Runs a raw query and returns its rows. Neon's HTTP driver and PGlite both answer
 * `{ rows }`; the shared `Db` type can't say so.
 */
export async function queryRows<T>(db: Db, query: SQL): Promise<T[]> {
  const result = (await db.execute(query)) as unknown as { rows: T[] };
  return result.rows;
}

/** The live tables (the admin's draft) as one JSON document. */
export const liveStoreJson = sql`jsonb_build_object(
  'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.id::text) from categories c), '[]'::jsonb),
  'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.id::text) from products p), '[]'::jsonb),
  'settings', (select to_jsonb(s) from store_settings s where s.id = 1)
)`;

/**
 * The same document without timestamps, for comparing the draft with what's published:
 * a save that changes nothing only moves `updated_at`.
 */
const liveComparable = sql`jsonb_build_object(
  'categories', coalesce((select jsonb_agg(to_jsonb(c) - 'created_at' - 'updated_at' order by c.id::text) from categories c), '[]'::jsonb),
  'products', coalesce((select jsonb_agg(to_jsonb(p) - 'created_at' - 'updated_at' order by p.id::text) from products p), '[]'::jsonb),
  'settings', (select to_jsonb(s) - 'updated_at' from store_settings s where s.id = 1)
)`;

const publishedComparable = sql`jsonb_build_object(
  'categories', coalesce((select jsonb_agg(e - 'created_at' - 'updated_at' order by e->>'id') from jsonb_array_elements(ps.data->'categories') e), '[]'::jsonb),
  'products', coalesce((select jsonb_agg(e - 'created_at' - 'updated_at' order by e->>'id') from jsonb_array_elements(ps.data->'products') e), '[]'::jsonb),
  'settings', (ps.data->'settings') - 'updated_at'
)`;

/** Copies the live tables into the snapshot. One statement, so it's atomic by itself. */
export function publishLiveTables(db: Db) {
  return db.execute(sql`
    insert into published_snapshot (id, data, published_at)
    values (1, ${liveStoreJson}, now())
    on conflict (id) do update
      set data = excluded.data, published_at = excluded.published_at
  `);
}

/**
 * Whether the draft differs from the published snapshot. True when nothing was ever
 * published.
 */
export async function hasUnpublishedChanges(db: Db): Promise<boolean> {
  const [row] = await queryRows<{ same: boolean }>(
    db,
    sql`
      select (${liveComparable}) is not distinct from (${publishedComparable}) as same
      from published_snapshot ps
      where ps.id = 1
    `,
  );
  return !row?.same;
}

/**
 * The statements that put the live tables back to the snapshot, to run in one
 * `atomic()` batch: products first (they reference categories), then categories, then
 * both re-inserted from the snapshot, then the settings row.
 */
export function restoreFromSnapshot(q: Db) {
  const snapshot = (key: string) =>
    sql`(select data->${key} from published_snapshot where id = 1)`;
  return [
    q.execute(sql`delete from products`),
    q.execute(sql`delete from categories`),
    q.execute(sql`
      insert into categories
      select * from jsonb_populate_recordset(null::categories, ${snapshot("categories")})
    `),
    q.execute(sql`
      insert into products
      select * from jsonb_populate_recordset(null::products, ${snapshot("products")})
    `),
    q.execute(sql`
      update store_settings s
      set name = r.name, headline = r.headline, tagline = r.tagline, phone = r.phone,
          email = r.email, address = r.address, updated_at = now()
      from jsonb_populate_record(null::store_settings, ${snapshot("settings")}) r
      where s.id = 1 and ${snapshot("settings")} is not null
    `),
  ] as const;
}
