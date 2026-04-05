import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
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
let roleId = "";

interface ImageInfoResponse {
  id: string;
  filename: string;
  path: string;
  url: string;
}

async function authRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const req = new Request(`${BASE_URL}${path}`, { ...options, headers });
  return app.fetch(req);
}

describe("Generic Image System (Roles)", () => {
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

    // Clean uploads dir
    const uploadDir = join(process.cwd(), "uploads", "roles");
    if (existsSync(uploadDir)) {
      rmSync(uploadDir, { recursive: true, force: true });
    }

    // Run seed
    // @ts-expect-error - drizzle type mismatch
    await seedRolePermissions(db);

    // Create and login admin
    await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@image.test",
        password: "Password123!",
        name: "Admin",
      }),
    });
    await db.execute(
      sql`UPDATE "user" SET role = 'admin', role_id = (SELECT id FROM "role" WHERE name = 'admin') WHERE email = 'admin@image.test'`,
    );

    const loginRes = await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@image.test",
        password: "Password123!",
      }),
    });
    adminCookie = loginRes.headers.get("set-cookie") || "";

    // Get a role ID to test with
    const result = await db.execute(sql`SELECT id FROM "role" LIMIT 1`);
    roleId = (result.rows[0] as { id: string }).id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("POST /api/roles/:id/images should upload a single image", async () => {
    const formData = new FormData();
    const blob = new Blob(["test-image-content"], { type: "image/png" });
    formData.append("file", blob, "test.png");

    const res = await authRequest(`/api/roles/${roleId}/images`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: ImageInfoResponse };
    expect(body.data.url).toContain(`/uploads/roles/${roleId}/`);
    expect(body.data.filename).toContain(".png");
  });

  it("POST /api/roles/:id/images/bulk should upload multiple images", async () => {
    const formData = new FormData();
    const blob1 = new Blob(["img1"], { type: "image/png" });
    const blob2 = new Blob(["img2"], { type: "image/png" });
    formData.append("files", blob1, "img1.png");
    formData.append("files", blob2, "img2.png");

    const res = await authRequest(`/api/roles/${roleId}/images/bulk`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: ImageInfoResponse[] };
    expect(body.data.length).toBe(2);
  });

  it("DELETE /api/roles/:id/images/:filename should remove a single image", async () => {
    // 1. Upload one to delete
    const formData = new FormData();
    const blob = new Blob(["delete-me"], { type: "image/png" });
    formData.append("file", blob, "delete-me.png");
    const upRes = await authRequest(`/api/roles/${roleId}/images`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: formData,
    });
    const upBody = (await upRes.json()) as { data: ImageInfoResponse };
    const filename = upBody.data.filename;

    // 2. Delete it
    const res = await authRequest(`/api/roles/${roleId}/images/${filename}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    // 3. Verify it's gone from filesystem
    const filePath = join(process.cwd(), "uploads", "roles", roleId, filename);
    expect(existsSync(filePath)).toBe(false);
  });

  it("DELETE /api/roles/:id/images should remove all images for a role", async () => {
    const res = await authRequest(`/api/roles/${roleId}/images`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { removedCount: number };
    expect(body.removedCount).toBeGreaterThan(0);

    // Verify dir is gone
    const dirPath = join(process.cwd(), "uploads", "roles", roleId);
    expect(existsSync(dirPath)).toBe(false);
  });
});
