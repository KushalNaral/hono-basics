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

interface PermissionResponse {
  id: string;
  name: string;
  groupName: string;
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

describe("Generic CRUD System (Permissions)", () => {
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

    // @ts-expect-error - drizzle type mismatch
    await seedRolePermissions(db);

    // Admin user
    await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@perm.test",
        password: "Password123!",
        name: "Admin",
      }),
    });
    await db.execute(
      sql`UPDATE "user" SET role = 'admin', role_id = (SELECT id FROM "role" WHERE name = 'admin') WHERE email = 'admin@perm.test'`,
    );
    const loginRes = await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "admin@perm.test", password: "Password123!" }),
    });
    adminCookie = loginRes.headers.get("set-cookie") || "";

    // Standard user
    await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "user@perm.test",
        password: "Password123!",
        name: "User",
      }),
    });
    const userLoginRes = await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "user@perm.test", password: "Password123!" }),
    });
    userCookie = userLoginRes.headers.get("set-cookie") || "";
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("Read Operations", () => {
    it("GET /api/permissions/all should return all seeded permissions", async () => {
      const res = await authRequest("/api/permissions/all", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: PermissionResponse[] }>(res);
      expect(body.data.length).toBeGreaterThan(10);
    });

    it("GET /api/permissions should return paginated list", async () => {
      const res = await authRequest("/api/permissions?page=1&pageSize=5", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: PermissionResponse[]; meta: PaginationMeta }>(res);
      expect(body.data.length).toBe(5);
      expect(body.meta.page).toBe(1);
      expect(body.meta.pageSize).toBe(5);
      expect(body.meta.totalCount).toBeGreaterThan(10);
    });

    it("GET /api/permissions/:id should return a single permission", async () => {
      const allRes = await authRequest("/api/permissions/all", {
        headers: { Cookie: adminCookie },
      });
      const all = await jsonBody<{ data: PermissionResponse[] }>(allRes);
      expect(all.data.length).toBeGreaterThan(0);
      const perm = all.data[0] as PermissionResponse;

      const res = await authRequest(`/api/permissions/${perm.id}`, {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: PermissionResponse }>(res);
      expect(body.data.name).toBe(perm.name);
      expect(body.data.groupName).toBe(perm.groupName);
    });
  });

  describe("Filtering", () => {
    it("GET /api/permissions/all?groupName=users should filter by group", async () => {
      const res = await authRequest("/api/permissions/all?groupName=users", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: PermissionResponse[] }>(res);
      expect(body.data.length).toBeGreaterThan(0);
      for (const perm of body.data) {
        expect(perm.groupName).toBe("users");
      }
    });

    it("GET /api/permissions/all?name_like=view should filter with partial match", async () => {
      const res = await authRequest("/api/permissions/all?name_like=view", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: PermissionResponse[] }>(res);
      expect(body.data.length).toBeGreaterThan(0);
      for (const perm of body.data) {
        expect(perm.name.toLowerCase()).toContain("view");
      }
    });
  });

  describe("Sorting", () => {
    it("GET /api/permissions should sort by name ascending", async () => {
      const res = await authRequest("/api/permissions?sortBy=name&sortDir=asc&pageSize=100", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: PermissionResponse[] }>(res);
      const names = body.data.map((p) => p.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it("GET /api/permissions should sort by groupName", async () => {
      const res = await authRequest("/api/permissions?sortBy=groupName&sortDir=asc&pageSize=100", {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: PermissionResponse[] }>(res);
      const groups = body.data.map((p) => p.groupName);
      const sorted = [...groups].sort();
      expect(groups).toEqual(sorted);
    });
  });

  describe("Create / Update / Delete", () => {
    let testPermId = "";

    it("POST /api/permissions should create a permission", async () => {
      const res = await authRequest("/api/permissions", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ name: "test-perm", groupName: "testing" }),
      });

      expect(res.status).toBe(201);
      const body = await jsonBody<{ data: PermissionResponse }>(res);
      expect(body.data.name).toBe("test-perm");
      expect(body.data.groupName).toBe("testing");
      testPermId = body.data.id;
    });

    it("PUT /api/permissions/:id should update a permission", async () => {
      const res = await authRequest(`/api/permissions/${testPermId}`, {
        method: "PUT",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ groupName: "updated-group" }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: PermissionResponse }>(res);
      expect(body.data.groupName).toBe("updated-group");
    });

    it("DELETE /api/permissions/:id should delete a permission", async () => {
      const res = await authRequest(`/api/permissions/${testPermId}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);

      const getRes = await authRequest(`/api/permissions/${testPermId}`, {
        headers: { Cookie: adminCookie },
      });
      expect(getRes.status).toBe(404);
    });
  });

  describe("Validation Errors", () => {
    it("POST /api/permissions should return 400 for missing name", async () => {
      const res = await authRequest("/api/permissions", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ groupName: "testing" }),
      });

      expect(res.status).toBe(400);
      const body = await jsonBody<ErrorResponse>(res);
      expect(body.error).toBe("Validation Error");
    });

    it("POST /api/permissions should return 400 for missing groupName", async () => {
      const res = await authRequest("/api/permissions", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ name: "some-perm" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("Permission Guards", () => {
    it("GET /api/permissions/all should return 403 for standard user", async () => {
      const res = await authRequest("/api/permissions/all", {
        headers: { Cookie: userCookie },
      });
      expect(res.status).toBe(403);
    });

    it("POST /api/permissions should return 403 for standard user", async () => {
      const res = await authRequest("/api/permissions", {
        method: "POST",
        headers: { Cookie: userCookie },
        body: JSON.stringify({ name: "forbidden-perm", groupName: "nope" }),
      });
      expect(res.status).toBe(403);
    });

    it("GET /api/permissions/all should return 401 without auth", async () => {
      const res = await authRequest("/api/permissions/all");
      expect(res.status).toBe(401);
    });
  });
});
