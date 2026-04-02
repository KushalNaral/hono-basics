import { describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { testMigrationTable } from "@/db/schema";
import { createEnv } from "@/lib/env";

const env = createEnv(process.env);
const db = drizzle(env.DB_URL);

describe("Database migrations", () => {
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

  it("should have created all auth tables", async () => {
    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = (result.rows as { table_name: string }[]).map((r) => r.table_name);
    expect(tables).toContain("user");
    expect(tables).toContain("session");
    expect(tables).toContain("account");
    expect(tables).toContain("verification");
    expect(tables).toContain("two_factor");
  });
});
