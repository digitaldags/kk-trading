import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { queryRows } from "@/lib/db/publish";
import { storeSettings } from "@/lib/db/schema";
import type { SettingsRepo } from "./types";

const SETTINGS_ID = 1;

export function createSettingsRepo(db: Db): SettingsRepo {
  return {
    async get() {
      const [row] = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.id, SETTINGS_ID));
      if (!row) return null;
      const { id: _id, ...settings } = row;
      return settings;
    },

    async update(values) {
      const [row] = await db
        .insert(storeSettings)
        .values({ id: SETTINGS_ID, ...values })
        .onConflictDoUpdate({
          target: storeSettings.id,
          set: { ...values, updatedAt: new Date() },
        })
        .returning();
      if (!row) throw new Error("Settings upsert returned no row.");
      const { id: _id, ...settings } = row;
      return settings;
    },

    // Like productRepo.isImageInUse: until the next publish, the storefront's snapshot
    // still has a logo the draft has replaced or removed.
    async isLogoInUse(url) {
      const [row] = await db
        .select({ id: storeSettings.id })
        .from(storeSettings)
        .where(
          and(
            eq(storeSettings.id, SETTINGS_ID),
            eq(storeSettings.logoUrl, url),
          ),
        );
      if (row) return true;
      const published = await queryRows(
        db,
        sql`
          select 1 from published_snapshot ps
          where ps.id = 1 and ps.data->'settings'->>'logo_url' = ${url}
        `,
      );
      return published.length > 0;
    },
  };
}
