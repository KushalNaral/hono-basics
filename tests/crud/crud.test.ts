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
let adminCookie = "";
let userCookie = "";

interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface ErrorResponse {
  error: string;
  message?: string;
  missing?: string[];
}

async function jsonBody<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

async function authRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const req = new Request(`${BASE_URL}${path}`, { ...options, headers });
  return app.fetch(req);
}

describe("Generic CRUD System (Roles)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: env.DB_URL });
    db = drizzle(pool);

    // Clean data
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

    // Create and login admin
    await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@crud.test",
        password: "Password123!",
        name: "Admin",
      }),
    });
    await db.execute(
      sql`UPDATE "user" SET role = 'admin', role_id = (SELECT id FROM "role" WHERE name = 'admin') WHERE email = 'admin@crud.test'`,
    );

    const loginRes = await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@crud.test",
        password: "Password123!",
      }),
    });
    adminCookie = loginRes.headers.get("set-cookie") || "";

    // Create and login standard user
    await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "user@crud.test",
        password: "Password123!",
        name: "User",
      }),
    });
    const userLoginRes = await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: "user@crud.test",
        password: "Password123!",
      }),
    });
    userCookie = userLoginRes.headers.get("set-cookie") || "";
  });

  afterAll(async () => {
    await pool.end();
  });

  // ---- Basic CRUD ----

  describe("Basic CRUD Operations", () => {
    let newRoleId = "";

    it("POST /api/roles should create a new role with permissions", async () => {
      const res = await authRequest("/api/roles", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({
          name: "test-role",
          description: "A test role",
          permissions: ["list-users", "view-users"],
        }),
      });

      expect(res.status).toBe(201);
      const body = await jsonBody<{ data: RoleResponse }>(res);
      expect(body.data.name).toBe("test-role");
      expect(body.data.id).toBeDefined();
      expect(body.data.createdAt).toBeDefined();
      newRoleId = body.data.id;
    });

    it("GET /api/roles/:id should return role with permissions expanded", async () => {
      const res = await authRequest(`/api/roles/${newRoleId}`, {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse }>(res);
      expect(body.data.name).toBe("test-role");
      expect(body.data.permissions).toContain("list-users");
      expect(body.data.permissions).toContain("view-users");
    });

    it("PUT /api/roles/:id should update role and permissions", async () => {
      const res = await authRequest(`/api/roles/${newRoleId}`, {
        method: "PUT",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({
          description: "Updated description",
          permissions: ["list-users"],
        }),
      });

      expect(res.status).toBe(200);

      const getRes = await authRequest(`/api/roles/${newRoleId}`, {
        headers: { Cookie: adminCookie },
      });
      const body = await jsonBody<{ data: RoleResponse }>(getRes);
      expect(body.data.description).toBe("Updated description");
      expect(body.data.permissions).toContain("list-users");
      expect(body.data.permissions).not.toContain("view-users");
    });

    it("GET /api/roles/all should return all roles", async () => {
      const res = await authRequest("/api/roles/all", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[] }>(res);
      expect(body.data.length).toBeGreaterThanOrEqual(4); // 3 seeded + 1 created
    });

    it("DELETE /api/roles/:id should remove the role", async () => {
      const res = await authRequest(`/api/roles/${newRoleId}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);

      const getRes = await authRequest(`/api/roles/${newRoleId}`, {
        headers: { Cookie: adminCookie },
      });
      expect(getRes.status).toBe(404);
    });
  });

  // ---- Pagination ----

  describe("Pagination", () => {
    const paginationRoleIds: string[] = [];

    beforeAll(async () => {
      // Create 5 extra roles for pagination testing
      for (let i = 1; i <= 5; i++) {
        const res = await authRequest("/api/roles", {
          method: "POST",
          headers: { Cookie: adminCookie },
          body: JSON.stringify({ name: `page-role-${i}`, description: `Pagination test ${i}` }),
        });
        const body = await jsonBody<{ data: RoleResponse }>(res);
        paginationRoleIds.push(body.data.id);
      }
    });

    afterAll(async () => {
      if (paginationRoleIds.length > 0) {
        await authRequest("/api/roles/bulk", {
          method: "DELETE",
          headers: { Cookie: adminCookie },
          body: JSON.stringify({ ids: paginationRoleIds }),
        });
      }
    });

    it("GET /api/roles should return paginated results with meta", async () => {
      const res = await authRequest("/api/roles?page=1&pageSize=2", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[]; meta: PaginationMeta }>(res);
      expect(body.data.length).toBe(2);
      expect(body.meta.page).toBe(1);
      expect(body.meta.pageSize).toBe(2);
      expect(body.meta.totalCount).toBeGreaterThanOrEqual(8); // 3 seeded + 5 created
      expect(body.meta.totalPages).toBeGreaterThanOrEqual(4);
    });

    it("GET /api/roles should return second page", async () => {
      const res = await authRequest("/api/roles?page=2&pageSize=2", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[]; meta: PaginationMeta }>(res);
      expect(body.data.length).toBe(2);
      expect(body.meta.page).toBe(2);
    });

    it("GET /api/roles should use default pagination when no params", async () => {
      const res = await authRequest("/api/roles", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[]; meta: PaginationMeta }>(res);
      expect(body.meta.page).toBe(1);
      expect(body.meta.pageSize).toBe(20);
    });

    it("GET /api/roles should return empty data for out-of-range page", async () => {
      const res = await authRequest("/api/roles?page=999&pageSize=10", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[]; meta: PaginationMeta }>(res);
      expect(body.data.length).toBe(0);
      expect(body.meta.page).toBe(999);
    });
  });

  // ---- Sorting ----

  describe("Sorting", () => {
    it("GET /api/roles should sort by name ascending", async () => {
      const res = await authRequest("/api/roles?sortBy=name&sortDir=asc&pageSize=100", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[] }>(res);
      const names = body.data.map((r) => r.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it("GET /api/roles should sort by name descending", async () => {
      const res = await authRequest("/api/roles?sortBy=name&sortDir=desc&pageSize=100", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[] }>(res);
      const names = body.data.map((r) => r.name);
      const sorted = [...names].sort().reverse();
      expect(names).toEqual(sorted);
    });
  });

  // ---- Filtering ----

  describe("Filtering", () => {
    it("GET /api/roles/all?name=admin should filter by exact name", async () => {
      const res = await authRequest("/api/roles/all?name=admin", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[] }>(res);
      expect(body.data.length).toBe(1);
      expect(body.data[0]?.name).toBe("admin");
    });

    it("GET /api/roles/all?name_like=admin should filter with partial match", async () => {
      const res = await authRequest("/api/roles/all?name_like=admin", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[] }>(res);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      for (const role of body.data) {
        expect(role.name.toLowerCase()).toContain("admin");
      }
    });

    it("GET /api/roles/all with non-matching filter should return empty", async () => {
      const res = await authRequest("/api/roles/all?name=nonexistent-role-xyz", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[] }>(res);
      expect(body.data.length).toBe(0);
    });
  });

  // ---- Error Cases ----

  describe("Error Cases", () => {
    it("GET /api/roles/:id should return 404 for non-existent ID", async () => {
      const res = await authRequest("/api/roles/00000000-0000-0000-0000-000000000000", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(404);
      const body = await jsonBody<ErrorResponse>(res);
      expect(body.error).toBe("Not Found");
    });

    it("PUT /api/roles/:id should return 404 for non-existent ID", async () => {
      const res = await authRequest("/api/roles/00000000-0000-0000-0000-000000000000", {
        method: "PUT",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ name: "nope" }),
      });

      expect(res.status).toBe(404);
    });

    it("DELETE /api/roles/:id should return 404 for non-existent ID", async () => {
      const res = await authRequest("/api/roles/00000000-0000-0000-0000-000000000000", {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(404);
    });

    it("POST /api/roles should return 400 for invalid body", async () => {
      const res = await authRequest("/api/roles", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ description: "missing name" }),
      });

      expect(res.status).toBe(400);
      const body = await jsonBody<ErrorResponse>(res);
      expect(body.error).toBe("Validation Error");
    });

    it("POST /api/roles/bulk should return 400 for invalid array items", async () => {
      const res = await authRequest("/api/roles/bulk", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify([{ description: "no name" }]),
      });

      expect(res.status).toBe(400);
      const body = await jsonBody<ErrorResponse>(res);
      expect(body.error).toBe("Validation Error");
    });

    it("DELETE /api/roles/bulk should return 400 for missing ids", async () => {
      const res = await authRequest("/api/roles/bulk", {
        method: "DELETE",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  // ---- Auth & Permission Guards ----

  describe("Auth & Permission Guards", () => {
    it("GET /api/roles/all should return 401 without auth", async () => {
      const res = await authRequest("/api/roles/all");
      expect(res.status).toBe(401);
    });

    it("GET /api/roles should return 401 without auth", async () => {
      const res = await authRequest("/api/roles");
      expect(res.status).toBe(401);
    });

    it("POST /api/roles should return 401 without auth", async () => {
      const res = await authRequest("/api/roles", {
        method: "POST",
        body: JSON.stringify({ name: "unauth-role" }),
      });
      expect(res.status).toBe(401);
    });

    it("GET /api/roles/all should return 403 for user without view-roles permission", async () => {
      const res = await authRequest("/api/roles/all", {
        headers: { Cookie: userCookie },
      });
      expect(res.status).toBe(403);
    });

    it("POST /api/roles should return 403 for user without create-roles permission", async () => {
      const res = await authRequest("/api/roles", {
        method: "POST",
        headers: { Cookie: userCookie },
        body: JSON.stringify({ name: "forbidden-role" }),
      });
      expect(res.status).toBe(403);
    });
  });

  // ---- Bulk Operations ----

  describe("Bulk Operations", () => {
    const bulkIds: string[] = [];

    it("POST /api/roles/bulk should create multiple roles", async () => {
      const res = await authRequest("/api/roles/bulk", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify([
          { name: "bulk-1", description: "Bulk 1" },
          { name: "bulk-2", description: "Bulk 2" },
        ]),
      });

      expect(res.status).toBe(201);
      const body = await jsonBody<{ data: RoleResponse[] }>(res);
      expect(body.data.length).toBe(2);
      for (const r of body.data) {
        bulkIds.push(r.id);
      }
    });

    it("PUT /api/roles/bulk should update multiple roles", async () => {
      const res = await authRequest("/api/roles/bulk", {
        method: "PUT",
        headers: { Cookie: adminCookie },
        body: JSON.stringify(
          bulkIds.map((id, i) => ({
            id,
            data: { description: `Bulk updated ${i + 1}` },
          })),
        ),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleResponse[] }>(res);
      expect(body.data.length).toBe(2);
      expect(body.data[0]?.description).toBe("Bulk updated 1");
      expect(body.data[1]?.description).toBe("Bulk updated 2");
    });

    it("DELETE /api/roles/bulk should delete multiple roles", async () => {
      const res = await authRequest("/api/roles/bulk", {
        method: "DELETE",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ ids: bulkIds }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ deletedCount: number }>(res);
      expect(body.deletedCount).toBe(2);
    });
  });
});
