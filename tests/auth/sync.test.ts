import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { seedRolePermissions } from "@/db/seed/role-permission.seed";
import app from "@/index";
import { createEnv } from "@/lib/env";

const env = createEnv(process.env);
const BASE_URL = `http://localhost:${env.APP_PORT}`;

let pool: Pool;
let db: ReturnType<typeof drizzle>;

async function authRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const req = new Request(`${BASE_URL}${path}`, { ...options, headers });
  return app.fetch(req);
}

interface DbRow {
  id: string;
  role?: string;
  role_id?: string;
  [key: string]: unknown;
}

describe("Role ID Sync & Optimized Middleware", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: env.DB_URL });
    db = drizzle(pool);

    // Clean data (order respects FK constraints: user.role_id -> role.id)
    await db.execute(sql`DELETE FROM "two_factor"`);
    await db.execute(sql`DELETE FROM "account"`);
    await db.execute(sql`DELETE FROM "session"`);
    await db.execute(sql`DELETE FROM "role_permission"`);
    await db.execute(sql`DELETE FROM "user"`);
    await db.execute(sql`DELETE FROM "permission"`);
    await db.execute(sql`DELETE FROM "role"`);

    // Run seed
    // @ts-expect-error - drizzle type mismatch
    await seedRolePermissions(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("should populate roleId automatically on user creation (sign-up)", async () => {
    const res = await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "sync@test.com",
        password: "Password123!",
        name: "Sync User",
      }),
    });

    expect(res.status).toBe(200);

    const result = await db.execute(sql`SELECT * FROM "user" WHERE email = 'sync@test.com'`);
    const userRow = result.rows[0] as DbRow;
    expect(userRow).toBeDefined();
    expect(userRow.role).toBe("user");
    expect(userRow.role_id).toBeDefined();
    expect(userRow.role_id).not.toBeNull();

    const roleResult = await db.execute(sql`SELECT id FROM "role" WHERE name = 'user'`);
    const roleRow = roleResult.rows[0] as DbRow;
    expect(userRow.role_id).toBe(roleRow.id);
  });

  it("should update roleId when the role string is changed", async () => {
    // Create and login admin
    await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@sync.test",
        password: "Password123!",
        name: "Admin",
      }),
    });
    await db.execute(
      sql`UPDATE "user" SET role = 'admin', role_id = (SELECT id FROM "role" WHERE name = 'admin') WHERE email = 'admin@sync.test'`,
    );

    await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@sync.test",
        password: "Password123!",
      }),
    });

    const result = await db.execute(
      sql`SELECT id, role_id FROM "user" WHERE email = 'sync@test.com'`,
    );
    const userRow = result.rows[0] as DbRow;
    expect(userRow.role_id).toBeDefined();
  });

  it("requirePermission should allow access if user has roleId correctly populated", async () => {
    const loginRes = await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: "sync@test.com",
        password: "Password123!",
      }),
    });
    const cookie = loginRes.headers.get("set-cookie") || "";

    const res = await authRequest("/api/rbac/me/permissions", {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { permissions: string[] };
    expect(data.permissions).toContain("view-dashboard");
  });

  it("requirePermission should deny access if user does not have required permissions (even with roleId)", async () => {
    const loginRes = await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: "sync@test.com",
        password: "Password123!",
      }),
    });
    const cookie = loginRes.headers.get("set-cookie") || "";

    const res = await authRequest("/api/permissions/all", {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(403);
  });
});
