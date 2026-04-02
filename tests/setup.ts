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
  console.log("Resetting test database...");
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

  console.log("Applying migrations to test database...");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully.");
  } catch (err) {
    console.error("Migration failed during setup:", err);
    throw err;
  }
});

afterAll(async () => {
  await pool.end();
});
