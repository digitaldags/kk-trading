import { eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";
import type { AdminUserRepo } from "./types";

export function createAdminUserRepo(db: Db): AdminUserRepo {
  return {
    async findByEmail(email) {
      const [row] = await db
        .select()
        .from(adminUsers)
        .where(sql`lower(${adminUsers.email}) = lower(${email.trim()})`);
      return row ?? null;
    },

    async findById(id) {
      const [row] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, id));
      return row ?? null;
    },

    async insert({ email, passwordHash }) {
      const [row] = await db
        .insert(adminUsers)
        .values({ email: email.trim().toLowerCase(), passwordHash })
        .returning();
      if (!row) throw new Error("Inserting the admin returned no row.");
      return row;
    },

    async updatePassword(id, passwordHash) {
      const [row] = await db
        .update(adminUsers)
        .set({ passwordHash, passwordChangedAt: new Date() })
        .where(eq(adminUsers.id, id))
        .returning();
      return row ?? null;
    },
  };
}
