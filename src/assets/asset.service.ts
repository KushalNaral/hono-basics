import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { asset } from "@/db/schema";
import { db } from "@/lib/db";

export type AssetSelect = typeof asset.$inferSelect;

const UPLOAD_DIR = join(process.cwd(), "uploads");

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function resourceDir(resourceType: string, resourceId: string): string {
  return join(UPLOAD_DIR, resourceType, resourceId);
}

function generateFilename(originalName: string): string {
  const ext = originalName.includes(".") ? `.${originalName.split(".").pop()}` : "";
  return `${crypto.randomUUID()}${ext}`;
}

async function writeFile(file: File, dir: string, filename: string): Promise<string> {
  ensureDir(dir);
  const filePath = join(dir, filename);
  const buffer = await file.arrayBuffer();
  writeFileSync(filePath, Buffer.from(buffer));
  return filePath;
}

function deleteFile(url: string): boolean {
  const filePath = join(process.cwd(), url);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    return true;
  }
  return false;
}

export const assetService = {
  async upload(
    file: File,
    resourceType: string,
    resourceId: string,
    executor: NodePgDatabase | typeof db = db,
  ): Promise<AssetSelect> {
    const dir = resourceDir(resourceType, resourceId);
    const filename = generateFilename(file.name);
    const url = `/uploads/${resourceType}/${resourceId}/${filename}`;

    // Write file first (orphaned file is less harmful than orphaned DB row)
    await writeFile(file, dir, filename);

    const rows = await executor
      .insert(asset as never)
      .values({
        resourceType,
        resourceId,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url,
      } as never)
      .returning();
    const row = (rows as AssetSelect[])[0];
    if (!row) throw new Error("Failed to insert asset");
    return row;
  },

  async uploadBulk(
    files: File[],
    resourceType: string,
    resourceId: string,
  ): Promise<AssetSelect[]> {
    const results: AssetSelect[] = [];
    for (const file of files) {
      const result = await this.upload(file, resourceType, resourceId);
      results.push(result);
    }
    return results;
  },

  async update(
    assetId: string,
    newFile: File,
    resourceType: string,
    resourceId: string,
  ): Promise<AssetSelect> {
    // Find existing asset
    const existing = await db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    const old = existing[0];

    // Delete old file if it exists
    if (old) {
      deleteFile(old.url);
    }

    // Write new file
    const dir = resourceDir(resourceType, resourceId);
    const filename = generateFilename(newFile.name);
    const url = `/uploads/${resourceType}/${resourceId}/${filename}`;
    await writeFile(newFile, dir, filename);

    if (old) {
      // Update existing DB row
      const rows = await db
        .update(asset as never)
        .set({
          filename,
          originalName: newFile.name,
          mimeType: newFile.type,
          size: newFile.size,
          url,
        } as never)
        .where(eq(asset.id, assetId))
        .returning();
      const row = (rows as AssetSelect[])[0];
      if (!row) throw new Error("Failed to update asset");
      return row;
    }

    // Asset didn't exist — create new
    return this.upload(newFile, resourceType, resourceId);
  },

  async updateBulk(
    updates: Array<{ assetId: string; newFile: File }>,
    resourceType: string,
    resourceId: string,
  ): Promise<AssetSelect[]> {
    const results: AssetSelect[] = [];
    for (const { assetId, newFile } of updates) {
      const result = await this.update(assetId, newFile, resourceType, resourceId);
      results.push(result);
    }
    return results;
  },

  async remove(assetId: string): Promise<boolean> {
    const existing = await db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    const row = existing[0];
    if (!row) return false;

    // Delete DB row first, then file
    await db.delete(asset as never).where(eq(asset.id, assetId));
    deleteFile(row.url);
    return true;
  },

  async removeResourceAssets(
    resourceType: string,
    resourceId: string,
    executor: NodePgDatabase | typeof db = db,
  ): Promise<number> {
    const rows = await executor
      .delete(asset as never)
      .where(and(eq(asset.resourceType, resourceType), eq(asset.resourceId, resourceId)))
      .returning();
    const count = (rows as unknown[]).length;

    // Clean up directory
    const dir = resourceDir(resourceType, resourceId);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }

    return count;
  },

  async listByResource(resourceType: string, resourceId: string): Promise<AssetSelect[]> {
    return db
      .select()
      .from(asset)
      .where(and(eq(asset.resourceType, resourceType), eq(asset.resourceId, resourceId)));
  },

  async getById(assetId: string): Promise<AssetSelect | null> {
    const rows = await db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    return rows[0] ?? null;
  },
};
