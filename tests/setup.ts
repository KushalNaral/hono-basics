import { afterAll, beforeAll } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { createEnv } from "@/lib/env";

const env = createEnv(process.env);

const pool = new Pool({ connectionString: env.DB_URL });
const db = drizzle(pool);

beforeAll(async () => {
  // Reset test DB to a clean state
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

  // Apply all migrations
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
  await pool.end();
});
