import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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

// biome-ignore lint/suspicious/noExplicitAny: test helper for untyped JSON responses
async function jsonBody(res: Response): Promise<any> {
  return res.json();
}

describe("Auth", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: env.DB_URL });
    db = drizzle(pool);

    // Clean data from previous runs
    await db.execute(sql`DELETE FROM "two_factor"`);
    await db.execute(sql`DELETE FROM "account"`);
    await db.execute(sql`DELETE FROM "session"`);
    await db.execute(sql`DELETE FROM "user"`);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM "two_factor"`);
    await db.execute(sql`DELETE FROM "account"`);
    await db.execute(sql`DELETE FROM "session"`);
    await db.execute(sql`DELETE FROM "user"`);
    await pool.end();
  });

  let sessionCookie = "";

  describe("Signup", () => {
    it("should create a new user", async () => {
      const res = await authRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "Password123!",
          name: "Test User",
        }),
      });

      expect(res.status).toBe(200);
      const data = await jsonBody(res);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe("test@example.com");
      expect(data.user.name).toBe("Test User");
      expect(data.user.role).toBe("user");
    });

    it("should reject duplicate email", async () => {
      const res = await authRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "Password123!",
          name: "Duplicate User",
        }),
      });

      expect(res.status).not.toBe(200);
    });
  });

  describe("Login", () => {
    it("should login with correct credentials", async () => {
      const res = await authRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "Password123!",
        }),
      });

      expect(res.status).toBe(200);
      const data = await jsonBody(res);
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();

      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
      sessionCookie = setCookie ?? "";
    });

    it("should reject wrong password", async () => {
      const res = await authRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "WrongPassword!",
        }),
      });

      expect(res.status).not.toBe(200);
    });
  });

  describe("Session middleware", () => {
    it("should return user on /me with valid session", async () => {
      const res = await authRequest("/me", {
        headers: { Cookie: sessionCookie },
      });

      expect(res.status).toBe(200);
      const data = await jsonBody(res);
      expect(data.user.email).toBe("test@example.com");
      expect(data.session).toBeDefined();
    });

    it("should return 401 on /me without session", async () => {
      const res = await authRequest("/me");

      expect(res.status).toBe(401);
    });
  });

  describe("Admin", () => {
    let adminCookie = "";

    it("should create an admin user and login", async () => {
      await authRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.com",
          password: "AdminPass123!",
          name: "Admin User",
        }),
      });

      await db.execute(sql`UPDATE "user" SET role = 'admin' WHERE email = 'admin@example.com'`);

      const res = await authRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.com",
          password: "AdminPass123!",
        }),
      });

      expect(res.status).toBe(200);
      adminCookie = res.headers.get("set-cookie") ?? "";
    });

    it("should list users as admin", async () => {
      const res = await authRequest("/api/auth/admin/list-users", {
        method: "GET",
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const data = await jsonBody(res);
      expect(data.users.length).toBeGreaterThanOrEqual(2);
    });

    it("should set user role as admin", async () => {
      const usersRes = await authRequest("/api/auth/admin/list-users", {
        method: "GET",
        headers: { Cookie: adminCookie },
      });
      const users = (await jsonBody(usersRes)).users;
      const testUser = users.find((u: { email: string }) => u.email === "test@example.com");

      const res = await authRequest("/api/auth/admin/set-role", {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: testUser.id,
          role: "moderator",
        }),
      });

      expect(res.status).toBe(200);
      const data = await jsonBody(res);
      expect(data.user.role).toBe("moderator");
    });

    it("should not allow non-admin to list users", async () => {
      await authRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          email: "plain@example.com",
          password: "PlainPass123!",
          name: "Plain User",
        }),
      });
      const loginRes = await authRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({
          email: "plain@example.com",
          password: "PlainPass123!",
        }),
      });
      const plainCookie = loginRes.headers.get("set-cookie") ?? "";

      const res = await authRequest("/api/auth/admin/list-users", {
        method: "GET",
        headers: { Cookie: plainCookie },
      });

      expect(res.status).not.toBe(200);
    });
  });
});
