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

interface AssetResponse {
  id: string;
  resourceType: string;
  resourceId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
  updatedAt: string;
}

interface RoleExpandedResponse {
  id: string;
  name: string;
  permissions: string[];
  assets: AssetResponse[];
}

async function authRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const req = new Request(`${BASE_URL}${path}`, { ...options, headers });
  return app.fetch(req);
}

async function jsonBody<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

describe("Asset System (Roles)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: env.DB_URL });
    db = drizzle(pool);

    // Clean data (FK-safe order)
    await db.execute(sql`DELETE FROM "asset"`);
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

    // Seed
    // @ts-expect-error - drizzle type mismatch
    await seedRolePermissions(db);

    // Create and login admin
    await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@asset.test",
        password: "Password123!",
        name: "Admin",
      }),
    });
    await db.execute(
      sql`UPDATE "user" SET role = 'admin', role_id = (SELECT id FROM "role" WHERE name = 'admin') WHERE email = 'admin@asset.test'`,
    );

    const loginRes = await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@asset.test",
        password: "Password123!",
      }),
    });
    adminCookie = loginRes.headers.get("set-cookie") || "";

    // Get a role ID
    const result = await db.execute(sql`SELECT id FROM "role" LIMIT 1`);
    roleId = (result.rows[0] as { id: string }).id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("Upload", () => {
    it("POST /api/roles/:id/assets should upload and track a single file", async () => {
      const formData = new FormData();
      const blob = new Blob(["test-image-content"], { type: "image/png" });
      formData.append("file", blob, "test.png");

      const res = await authRequest(`/api/roles/${roleId}/assets`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = await jsonBody<{ data: AssetResponse }>(res);
      expect(body.data.id).toBeDefined();
      expect(body.data.resourceType).toBe("roles");
      expect(body.data.resourceId).toBe(roleId);
      expect(body.data.originalName).toBe("test.png");
      expect(body.data.mimeType).toBe("image/png");
      expect(body.data.size).toBeGreaterThan(0);
      expect(body.data.url).toContain(`/uploads/roles/${roleId}/`);

      // Verify file exists on disk
      const filePath = join(process.cwd(), body.data.url);
      expect(existsSync(filePath)).toBe(true);

      // Verify DB record exists
      const dbResult = await db.execute(sql`SELECT * FROM "asset" WHERE id = ${body.data.id}`);
      expect(dbResult.rows.length).toBe(1);
    });

    it("POST /api/roles/:id/assets/bulk should upload multiple files", async () => {
      const formData = new FormData();
      const blob1 = new Blob(["img1"], { type: "image/png" });
      const blob2 = new Blob(["img2"], { type: "image/jpeg" });
      formData.append("files", blob1, "img1.png");
      formData.append("files", blob2, "img2.jpg");

      const res = await authRequest(`/api/roles/${roleId}/assets/bulk`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = await jsonBody<{ data: AssetResponse[] }>(res);
      expect(body.data.length).toBe(2);
      expect(body.data[0]?.originalName).toBe("img1.png");
      expect(body.data[1]?.originalName).toBe("img2.jpg");
    });
  });

  describe("List", () => {
    it("GET /api/roles/:id/assets should return tracked assets", async () => {
      const res = await authRequest(`/api/roles/${roleId}/assets`, {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: AssetResponse[] }>(res);
      expect(body.data.length).toBeGreaterThanOrEqual(3); // from upload tests
      for (const asset of body.data) {
        expect(asset.resourceType).toBe("roles");
        expect(asset.resourceId).toBe(roleId);
        expect(asset.id).toBeDefined();
        expect(asset.filename).toBeDefined();
      }
    });
  });

  describe("Update", () => {
    it("PUT /api/roles/:id/assets/:assetId should replace a file", async () => {
      // Get an existing asset
      const listRes = await authRequest(`/api/roles/${roleId}/assets`, {
        headers: { Cookie: adminCookie },
      });
      const assets = await jsonBody<{ data: AssetResponse[] }>(listRes);
      const target = assets.data[0] as AssetResponse;
      const oldFilename = target.filename;

      // Upload replacement
      const formData = new FormData();
      const blob = new Blob(["replaced-content"], { type: "image/webp" });
      formData.append("file", blob, "replaced.webp");

      const res = await authRequest(`/api/roles/${roleId}/assets/${target.id}`, {
        method: "PUT",
        headers: { Cookie: adminCookie },
        body: formData,
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: AssetResponse }>(res);
      expect(body.data.id).toBe(target.id);
      expect(body.data.originalName).toBe("replaced.webp");
      expect(body.data.mimeType).toBe("image/webp");
      expect(body.data.filename).not.toBe(oldFilename);

      // Old file should be gone
      const oldPath = join(process.cwd(), target.url);
      expect(existsSync(oldPath)).toBe(false);

      // New file should exist
      const newPath = join(process.cwd(), body.data.url);
      expect(existsSync(newPath)).toBe(true);
    });
  });

  describe("Delete", () => {
    it("DELETE /api/roles/:id/assets/:assetId should remove a single asset", async () => {
      // Upload one to delete
      const formData = new FormData();
      const blob = new Blob(["delete-me"], { type: "image/png" });
      formData.append("file", blob, "delete-me.png");
      const upRes = await authRequest(`/api/roles/${roleId}/assets`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: formData,
      });
      const upBody = await jsonBody<{ data: AssetResponse }>(upRes);
      const assetId = upBody.data.id;
      const assetUrl = upBody.data.url;

      // Delete it
      const res = await authRequest(`/api/roles/${roleId}/assets/${assetId}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ success: boolean }>(res);
      expect(body.success).toBe(true);

      // Verify file is gone
      expect(existsSync(join(process.cwd(), assetUrl))).toBe(false);

      // Verify DB record is gone
      const dbResult = await db.execute(sql`SELECT * FROM "asset" WHERE id = ${assetId}`);
      expect(dbResult.rows.length).toBe(0);
    });

    it("DELETE /api/roles/:id/assets should remove all assets for a role", async () => {
      const res = await authRequest(`/api/roles/${roleId}/assets`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ removedCount: number }>(res);
      expect(body.removedCount).toBeGreaterThan(0);

      // Verify DB records are gone
      const dbResult = await db.execute(
        sql`SELECT * FROM "asset" WHERE resource_type = 'roles' AND resource_id = ${roleId}`,
      );
      expect(dbResult.rows.length).toBe(0);

      // Verify directory is gone
      const dirPath = join(process.cwd(), "uploads", "roles", roleId);
      expect(existsSync(dirPath)).toBe(false);
    });
  });

  describe("Resource integration", () => {
    it("GET /api/roles/:id should include assets in response", async () => {
      // Upload an asset first
      const formData = new FormData();
      const blob = new Blob(["integration-test"], { type: "image/png" });
      formData.append("file", blob, "integration.png");
      await authRequest(`/api/roles/${roleId}/assets`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: formData,
      });

      // Fetch role — should include assets
      const res = await authRequest(`/api/roles/${roleId}`, {
        headers: { Cookie: adminCookie },
      });

      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: RoleExpandedResponse }>(res);
      expect(body.data.assets).toBeDefined();
      expect(body.data.assets.length).toBeGreaterThanOrEqual(1);
      expect(body.data.assets[0]?.resourceType).toBe("roles");
      expect(body.data.assets[0]?.originalName).toBe("integration.png");
    });

    it("Deleting a role should clean up its assets", async () => {
      // Create a new role
      const createRes = await authRequest("/api/roles", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ name: "asset-cleanup-test" }),
      });
      const created = await jsonBody<{ data: { id: string } }>(createRes);
      const newRoleId = created.data.id;

      // Upload an asset to it
      const formData = new FormData();
      const blob = new Blob(["cleanup-test"], { type: "image/png" });
      formData.append("file", blob, "cleanup.png");
      const uploadRes = await authRequest(`/api/roles/${newRoleId}/assets`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: formData,
      });
      const uploaded = await jsonBody<{ data: AssetResponse }>(uploadRes);

      // Delete the role
      const deleteRes = await authRequest(`/api/roles/${newRoleId}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      });
      expect(deleteRes.status).toBe(200);

      // Verify asset DB record is gone
      const dbResult = await db.execute(sql`SELECT * FROM "asset" WHERE id = ${uploaded.data.id}`);
      expect(dbResult.rows.length).toBe(0);

      // Verify file is gone
      const dirPath = join(process.cwd(), "uploads", "roles", newRoleId);
      expect(existsSync(dirPath)).toBe(false);
    });
  });

  describe("Auth guards", () => {
    it("POST /api/roles/:id/assets should return 401 without auth", async () => {
      const formData = new FormData();
      const blob = new Blob(["nope"], { type: "image/png" });
      formData.append("file", blob, "nope.png");

      const res = await authRequest(`/api/roles/${roleId}/assets`, {
        method: "POST",
        body: formData,
      });
      expect(res.status).toBe(401);
    });

    it("GET /api/roles/:id/assets should return 401 without auth", async () => {
      const res = await authRequest(`/api/roles/${roleId}/assets`);
      expect(res.status).toBe(401);
    });
  });
});
