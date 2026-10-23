import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
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
  };
}
