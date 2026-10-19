import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// `db:generate` needs no database. `db:studio` reads DATABASE_URL, from .env.local if it's not set.
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
