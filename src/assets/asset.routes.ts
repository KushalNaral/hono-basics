import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import type { AuthVariables } from "@/lib/auth";
import { requireAuth, requirePermission } from "@/lib/auth";
import { ErrorSchema } from "@/lib/auth/schemas";
import {
  AssetListResponseSchema,
  AssetRemoveResponseSchema,
  AssetUploadResponseSchema,
  BulkAssetRemoveResponseSchema,
  BulkAssetUploadResponseSchema,
} from "./asset.schemas";
import { assetService } from "./asset.service";
import { serializeMany, serializeSingle } from "./serialization";

export interface AssetRouteConfig {
  resourceType: string;
  idParam: string;
  permissions?: {
    upload?: string;
    update?: string;
    remove?: string;
    list?: string;
  };
  tags?: string[];
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

function validateFile(file: File, maxSize: number, allowedTypes: string[]): string | null {
  if (file.size > maxSize) {
    return `File ${file.name} exceeds maximum size of ${maxSize / 1024 / 1024}MB`;
  }
  if (!allowedTypes.includes(file.type)) {
    return `File ${file.name} has unsupported type ${file.type}`;
  }
  return null;
}

function extractFiles(raw: string | File | (string | File)[] | undefined): File[] {
  if (Array.isArray(raw)) return raw.filter((f): f is File => f instanceof File);
  if (raw instanceof File) return [raw];
  return [];
}

function extractStrings(raw: string | File | (string | File)[] | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === "string");
  if (typeof raw === "string") return [raw];
  return [];
}

function validateFiles(files: File[], maxSize: number, allowedTypes: string[]): string | null {
  for (const file of files) {
    const err = validateFile(file, maxSize, allowedTypes);
    if (err) return err;
  }
  return null;
}

export function createAssetRoutes(config: AssetRouteConfig): Hono<{ Variables: AuthVariables }> {
  const router = new Hono<{ Variables: AuthVariables }>();
  const {
    resourceType,
    idParam,
    permissions,
    tags,
    maxFileSize = DEFAULT_MAX_SIZE,
    allowedMimeTypes = DEFAULT_MIME_TYPES,
  } = config;

  const tagsMeta = tags ? { tags } : {};

  function middlewareFor(op: string) {
    const mw = [requireAuth];
    const perm = permissions?.[op as keyof typeof permissions];
    if (perm) mw.push(requirePermission(perm));
    return mw;
  }

  // ---- GET /:id/assets (list) ----
  router.get(
    `/:${idParam}/assets`,
    describeRoute({
      summary: `List assets for ${resourceType}`,
      ...tagsMeta,
      responses: {
        200: {
          description: "Asset list",
          content: { "application/json": { schema: resolver(AssetListResponseSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    ...middlewareFor("list"),
    async (c) => {
      const resourceId = c.req.param(idParam) ?? "";
      const assets = await assetService.listByResource(resourceType, resourceId);
      return c.json({ data: serializeMany(assets) }, 200);
    },
  );

  // ---- POST /:id/assets (upload single) ----
  router.post(
    `/:${idParam}/assets`,
    describeRoute({
      summary: `Upload asset for ${resourceType}`,
      ...tagsMeta,
      responses: {
        201: {
          description: "Asset uploaded",
          content: { "application/json": { schema: resolver(AssetUploadResponseSchema) } },
        },
        400: {
          description: "Invalid file",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    ...middlewareFor("upload"),
    async (c) => {
      const resourceId = c.req.param(idParam) ?? "";
      const body = await c.req.parseBody();
      const file = body.file;

      if (!(file && file instanceof File)) {
        return c.json({ error: "Bad Request", message: "No file provided in 'file' field" }, 400);
      }

      const err = validateFile(file, maxFileSize, allowedMimeTypes);
      if (err) return c.json({ error: "Bad Request", message: err }, 400);

      const data = await assetService.upload(file, resourceType, resourceId);
      return c.json({ data: serializeSingle(data) }, 201);
    },
  );

  // ---- POST /:id/assets/bulk (upload multiple) ----
  router.post(
    `/:${idParam}/assets/bulk`,
    describeRoute({
      summary: `Bulk upload assets for ${resourceType}`,
      ...tagsMeta,
      responses: {
        201: {
          description: "Assets uploaded",
          content: { "application/json": { schema: resolver(BulkAssetUploadResponseSchema) } },
        },
        400: {
          description: "Invalid files",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    ...middlewareFor("upload"),
    async (c) => {
      const resourceId = c.req.param(idParam) ?? "";
      const body = await c.req.parseBody({ all: true });
      const files = extractFiles(body.files);

      if (files.length === 0) {
        return c.json({ error: "Bad Request", message: "No files provided in 'files' field" }, 400);
      }

      const err = validateFiles(files, maxFileSize, allowedMimeTypes);
      if (err) return c.json({ error: "Bad Request", message: err }, 400);

      const data = await assetService.uploadBulk(files, resourceType, resourceId);
      return c.json({ data: serializeMany(data) }, 201);
    },
  );

  // ---- PUT /:id/assets/:assetId (update single) ----
  router.put(
    `/:${idParam}/assets/:assetId`,
    describeRoute({
      summary: `Update asset for ${resourceType}`,
      ...tagsMeta,
      responses: {
        200: {
          description: "Asset updated",
          content: { "application/json": { schema: resolver(AssetUploadResponseSchema) } },
        },
        400: {
          description: "Invalid file",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    ...middlewareFor("update"),
    async (c) => {
      const resourceId = c.req.param(idParam) ?? "";
      const assetId = c.req.param("assetId") ?? "";

      const body = await c.req.parseBody();
      const file = body.file;

      if (!(file && file instanceof File)) {
        return c.json({ error: "Bad Request", message: "No file provided in 'file' field" }, 400);
      }

      const err = validateFile(file, maxFileSize, allowedMimeTypes);
      if (err) return c.json({ error: "Bad Request", message: err }, 400);

      const data = await assetService.update(assetId, file, resourceType, resourceId);
      return c.json({ data: serializeSingle(data) }, 200);
    },
  );

  // ---- PUT /:id/assets/bulk (update multiple) ----
  router.put(
    `/:${idParam}/assets/bulk`,
    describeRoute({
      summary: `Bulk update assets for ${resourceType}`,
      ...tagsMeta,
      responses: {
        200: {
          description: "Assets updated",
          content: { "application/json": { schema: resolver(BulkAssetUploadResponseSchema) } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    ...middlewareFor("update"),
    async (c) => {
      const resourceId = c.req.param(idParam) ?? "";
      const body = await c.req.parseBody({ all: true });

      const assetIds = extractStrings(body.assetIds);
      const files = extractFiles(body.files);

      if (files.length === 0 || assetIds.length !== files.length) {
        return c.json(
          { error: "Bad Request", message: "Must provide equal number of 'assetIds' and 'files'" },
          400,
        );
      }

      const err = validateFiles(files, maxFileSize, allowedMimeTypes);
      if (err) return c.json({ error: "Bad Request", message: err }, 400);

      const updates = assetIds.map((assetId, i) => {
        const newFile = files[i];
        if (!newFile) throw new Error("File count mismatch");
        return { assetId, newFile };
      });
      const data = await assetService.updateBulk(updates, resourceType, resourceId);
      return c.json({ data: serializeMany(data) }, 200);
    },
  );

  // ---- DELETE /:id/assets/:assetId (remove single) ----
  router.delete(
    `/:${idParam}/assets/:assetId`,
    describeRoute({
      summary: `Remove asset for ${resourceType}`,
      ...tagsMeta,
      responses: {
        200: {
          description: "Asset removed",
          content: { "application/json": { schema: resolver(AssetRemoveResponseSchema) } },
        },
        404: {
          description: "Asset not found",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    ...middlewareFor("remove"),
    async (c) => {
      const assetId = c.req.param("assetId") ?? "";
      const success = await assetService.remove(assetId);
      if (!success) {
        return c.json({ error: "Not Found", message: "Asset not found" }, 404);
      }
      return c.json({ success: true }, 200);
    },
  );

  // ---- DELETE /:id/assets (remove all for resource) ----
  router.delete(
    `/:${idParam}/assets`,
    describeRoute({
      summary: `Remove all assets for ${resourceType}`,
      ...tagsMeta,
      responses: {
        200: {
          description: "All assets removed",
          content: { "application/json": { schema: resolver(BulkAssetRemoveResponseSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    ...middlewareFor("remove"),
    async (c) => {
      const resourceId = c.req.param(idParam) ?? "";
      const removedCount = await assetService.removeResourceAssets(resourceType, resourceId);
      return c.json({ removedCount }, 200);
    },
  );

  return router;
}
