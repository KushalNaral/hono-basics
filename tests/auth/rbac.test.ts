import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { seedRolePermissions } from "@/db/seed/role-permission.seed";
import app from "@/index";
import { rbac } from "@/lib/auth/rbac";
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

interface DataListResponse {
  data: { name?: string; id?: string }[];
}

interface MePermissionsResponse {
  role: string;
  permissions: string[];
}

async function jsonBody<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

describe("RBAC System", () => {
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
    // @ts-expect-error - drizzle type mismatch in tests sometimes
    await seedRolePermissions(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("Utility: rbac", () => {
    it("should return correct permissions for admin", async () => {
      const perms = await rbac.getPermissionsByRole("admin");
      expect(perms.length).toBeGreaterThan(10);
    });

    it("should return correct permissions for user", async () => {
      const perms = await rbac.getPermissionsByRole("user");
      expect(perms.length).toBe(2);
      expect(perms.map((p) => p.name)).toContain("view-dashboard");
    });

    it("should verify permissions correctly", async () => {
      const hasAccess = await rbac.hasPermissions("moderator", ["list-users", "view-users"]);
      expect(hasAccess).toBe(true);

      const noAccess = await rbac.hasPermissions("user", ["list-users"]);
      expect(noAccess).toBe(false);
    });
  });

  describe("API: /api/rbac", () => {
    let adminCookie = "";
    let userCookie = "";

    beforeAll(async () => {
      // Create admin user
      await authRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@rbac.test",
          password: "Password123!",
          name: "Admin",
        }),
      });
      await db.execute(sql`UPDATE "user" SET role = 'admin' WHERE email = 'admin@rbac.test'`);
      const adminLogin = await authRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@rbac.test",
          password: "Password123!",
        }),
      });
      adminCookie = adminLogin.headers.get("set-cookie") || "";

      // Create standard user
      await authRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          email: "user@rbac.test",
          password: "Password123!",
          name: "User",
        }),
      });
      const userLogin = await authRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({
          email: "user@rbac.test",
          password: "Password123!",
        }),
      });
      userCookie = userLogin.headers.get("set-cookie") || "";
    });

    it("GET /permissions/all should be accessible to admin", async () => {
      const res = await authRequest("/api/permissions/all", {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const data = await jsonBody<DataListResponse>(res);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it("GET /permissions/all should be forbidden for standard user", async () => {
      const res = await authRequest("/api/permissions/all", {
        headers: { Cookie: userCookie },
      });
      expect(res.status).toBe(403);
    });

    it("GET /roles/all should be accessible to admin", async () => {
      const res = await authRequest("/api/roles/all", {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const data = await jsonBody<DataListResponse>(res);
      expect(data.data.length).toBe(3);
    });

    it("GET /me/permissions should return correct permissions for user", async () => {
      const res = await authRequest("/api/rbac/me/permissions", {
        headers: { Cookie: userCookie },
      });
      expect(res.status).toBe(200);
      const data = await jsonBody<MePermissionsResponse>(res);
      expect(data.role).toBe("user");
      expect(data.permissions).toContain("view-dashboard");
      expect(data.permissions).not.toContain("list-users");
    });
  });

  describe("Middleware: requirePermission", () => {
    let moderatorCookie = "";

    beforeAll(async () => {
      // Create moderator
      await authRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          email: "mod@rbac.test",
          password: "Password123!",
          name: "Mod",
        }),
      });
      await db.execute(sql`UPDATE "user" SET role = 'moderator' WHERE email = 'mod@rbac.test'`);
      const modLogin = await authRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({
          email: "mod@rbac.test",
          password: "Password123!",
        }),
      });
      moderatorCookie = modLogin.headers.get("set-cookie") || "";
    });

    it("should allow moderator to access moderation-related endpoints", async () => {
      const res = await authRequest("/api/permissions/all", {
        headers: { Cookie: moderatorCookie },
      });
      expect(res.status).toBe(200);
    });

    it("should allow moderator to view roles", async () => {
      const res = await authRequest("/api/roles/all", {
        headers: { Cookie: moderatorCookie },
      });
      expect(res.status).toBe(200);
    });
  });
});
