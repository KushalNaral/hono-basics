import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { testMigrationTable } from "@/db/schema";

const TEST_DB_URL =
  process.env.DB_URL ?? "postgresql://postgres:postgres123@localhost:5433/hono_db";

let pool: Pool;
let db: ReturnType<typeof drizzle>;

describe("Database migrations", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL });
    db = drizzle(pool);

    // Clean slate: drop any leftover tables and drizzle tracking schema from previous runs
    await db.execute(sql`DROP TABLE IF EXISTS "test-migration" CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  });

  afterAll(async () => {
    await db.execute(sql`DROP TABLE IF EXISTS "test-migration" CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await pool.end();
  });

  it("should run migrations without error", async () => {
    await expect(migrate(db, { migrationsFolder: "./drizzle" })).resolves.toBeUndefined();
  });

  it("should have created the test-migration table", async () => {
    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'test-migration'
    `);
    expect(result.rows.length).toBe(1);
  });

  it("should have correct columns on test-migration table", async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'test-migration'
      ORDER BY ordinal_position
    `);
    const columns = result.rows as { column_name: string; data_type: string }[];
    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column_name: "id", data_type: "integer" }),
        expect.objectContaining({ column_name: "name", data_type: "character varying" }),
      ]),
    );
  });

  it("should insert and read a row via the typed schema", async () => {
    await db.insert(testMigrationTable).values({ name: "migration-test-row" });

    const rows = await db.select().from(testMigrationTable);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.name).toBe("migration-test-row");
  });
});
