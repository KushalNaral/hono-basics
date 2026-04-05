import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UPLOAD_DIR = join(process.cwd(), "uploads");

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function resourceDir(resourceType: string, resourceId: string): string {
  return join(UPLOAD_DIR, resourceType, resourceId);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function generateFilename(originalName: string): string {
  const ext = originalName.includes(".") ? `.${originalName.split(".").pop()}` : "";
  return `${crypto.randomUUID()}${ext}`;
}

export interface ImageInfo {
  id: string;
  filename: string;
  path: string;
  url: string;
}

export const imageService = {
  async uploadImage(file: File, resourceType: string, resourceId: string): Promise<ImageInfo> {
    const dir = resourceDir(resourceType, resourceId);
    ensureDir(dir);

    const id = crypto.randomUUID();
    const filename = generateFilename(sanitizeFilename(file.name));
    const filePath = join(dir, filename);

    const buffer = await file.arrayBuffer();
    writeFileSync(filePath, Buffer.from(buffer));

    return {
      id,
      filename,
      path: filePath,
      url: `/uploads/${resourceType}/${resourceId}/${filename}`,
    };
  },

  async uploadBulkImages(
    files: File[],
    resourceType: string,
    resourceId: string,
  ): Promise<ImageInfo[]> {
    const results: ImageInfo[] = [];
    for (const file of files) {
      const result = await this.uploadImage(file, resourceType, resourceId);
      results.push(result);
    }
    return results;
  },

  async updateImage(
    oldUrl: string,
    newFile: File,
    resourceType: string,
    resourceId: string,
  ): Promise<ImageInfo> {
    // Remove old file
    const oldPath = join(process.cwd(), oldUrl);
    if (existsSync(oldPath)) {
      unlinkSync(oldPath);
    }

    return await this.uploadImage(newFile, resourceType, resourceId);
  },

  async updateBulkImages(
    updates: Array<{ oldUrl: string; newFile: File }>,
    resourceType: string,
    resourceId: string,
  ): Promise<ImageInfo[]> {
    const results: ImageInfo[] = [];
    for (const { oldUrl, newFile } of updates) {
      const result = await this.updateImage(oldUrl, newFile, resourceType, resourceId);
      results.push(result);
    }
    return results;
  },

  removeImage(url: string): boolean {
    const filePath = join(process.cwd(), url);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  },

  removeResourceImages(resourceType: string, resourceId: string): number {
    const dir = resourceDir(resourceType, resourceId);
    if (!existsSync(dir)) return 0;

    const files = readdirSync(dir);
    const count = files.length;
    rmSync(dir, { recursive: true, force: true });
    return count;
  },

  listImages(resourceType: string, resourceId: string): ImageInfo[] {
    const dir = resourceDir(resourceType, resourceId);
    if (!existsSync(dir)) return [];

    return readdirSync(dir).map((filename) => ({
      id: filename.split(".")[0] ?? filename,
      filename,
      path: join(dir, filename),
      url: `/uploads/${resourceType}/${resourceId}/${filename}`,
    }));
  },
};
