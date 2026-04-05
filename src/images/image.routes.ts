import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import type { AuthVariables } from "@/lib/auth";
import { requireAuth, requirePermission } from "@/lib/auth";
import { ErrorSchema } from "@/lib/auth/schemas";
import {
  BulkImageRemoveResponseSchema,
  BulkImageUploadResponseSchema,
  ImageRemoveResponseSchema,
  ImageUploadResponseSchema,
} from "./image.schemas";
import { imageService } from "./image.service";

export interface ImageRouteConfig {
  resourceType: string;
  idParam: string;
  permissions?: {
    upload?: string;
    update?: string;
    remove?: string;
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

export function createImageRoutes(config: ImageRouteConfig): Hono<{ Variables: AuthVariables }> {
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

  // ---- POST /:id/images (upload single) ----
  router.post(
    `/:${idParam}/images`,
    describeRoute({
      summary: `Upload image for ${resourceType}`,
      ...tagsMeta,
      responses: {
        201: {
          description: "Image uploaded",
          content: { "application/json": { schema: resolver(ImageUploadResponseSchema) } },
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

      const data = await imageService.uploadImage(file, resourceType, resourceId);
      return c.json({ data }, 201);
    },
  );

  // ---- POST /:id/images/bulk (upload multiple) ----
  router.post(
    `/:${idParam}/images/bulk`,
    describeRoute({
      summary: `Bulk upload images for ${resourceType}`,
      ...tagsMeta,
      responses: {
        201: {
          description: "Images uploaded",
          content: { "application/json": { schema: resolver(BulkImageUploadResponseSchema) } },
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

      const data = await imageService.uploadBulkImages(files, resourceType, resourceId);
      return c.json({ data }, 201);
    },
  );

  // ---- PUT /:id/images/:imageFilename (update single) ----
  router.put(
    `/:${idParam}/images/:imageFilename`,
    describeRoute({
      summary: `Update image for ${resourceType}`,
      ...tagsMeta,
      responses: {
        200: {
          description: "Image updated",
          content: { "application/json": { schema: resolver(ImageUploadResponseSchema) } },
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
      const imageFilename = c.req.param("imageFilename") ?? "";
      const oldUrl = `/uploads/${resourceType}/${resourceId}/${imageFilename}`;

      const body = await c.req.parseBody();
      const file = body.file;

      if (!(file && file instanceof File)) {
        return c.json({ error: "Bad Request", message: "No file provided in 'file' field" }, 400);
      }

      const err = validateFile(file, maxFileSize, allowedMimeTypes);
      if (err) return c.json({ error: "Bad Request", message: err }, 400);

      const data = await imageService.updateImage(oldUrl, file, resourceType, resourceId);
      return c.json({ data }, 200);
    },
  );

  // ---- PUT /:id/images/bulk (update multiple) ----
  router.put(
    `/:${idParam}/images/bulk`,
    describeRoute({
      summary: `Bulk update images for ${resourceType}`,
      ...tagsMeta,
      responses: {
        200: {
          description: "Images updated",
          content: { "application/json": { schema: resolver(BulkImageUploadResponseSchema) } },
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

      const oldUrls = extractStrings(body.oldUrls);
      const files = extractFiles(body.files);

      if (files.length === 0 || oldUrls.length !== files.length) {
        return c.json(
          { error: "Bad Request", message: "Must provide equal number of 'oldUrls' and 'files'" },
          400,
        );
      }

      const err = validateFiles(files, maxFileSize, allowedMimeTypes);
      if (err) return c.json({ error: "Bad Request", message: err }, 400);

      const updates = oldUrls.map((oldUrl, i) => {
        const newFile = files[i];
        if (!newFile) throw new Error("File count mismatch");
        return { oldUrl, newFile };
      });
      const data = await imageService.updateBulkImages(updates, resourceType, resourceId);
      return c.json({ data }, 200);
    },
  );

  // ---- DELETE /:id/images/:imageFilename (remove single) ----
  router.delete(
    `/:${idParam}/images/:imageFilename`,
    describeRoute({
      summary: `Remove image for ${resourceType}`,
      ...tagsMeta,
      responses: {
        200: {
          description: "Image removed",
          content: { "application/json": { schema: resolver(ImageRemoveResponseSchema) } },
        },
        404: {
          description: "Image not found",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    ...middlewareFor("remove"),
    async (c) => {
      const resourceId = c.req.param(idParam) ?? "";
      const imageFilename = c.req.param("imageFilename") ?? "";
      const url = `/uploads/${resourceType}/${resourceId}/${imageFilename}`;

      const success = imageService.removeImage(url);
      if (!success) {
        return c.json({ error: "Not Found", message: "Image not found" }, 404);
      }
      return c.json({ success: true }, 200);
    },
  );

  // ---- DELETE /:id/images (remove all for resource) ----
  router.delete(
    `/:${idParam}/images`,
    describeRoute({
      summary: `Remove all images for ${resourceType}`,
      ...tagsMeta,
      responses: {
        200: {
          description: "All images removed",
          content: { "application/json": { schema: resolver(BulkImageRemoveResponseSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    ...middlewareFor("remove"),
    async (c) => {
      const resourceId = c.req.param(idParam) ?? "";
      const removedCount = imageService.removeResourceImages(resourceType, resourceId);
      return c.json({ removedCount }, 200);
    },
  );

  return router;
}
