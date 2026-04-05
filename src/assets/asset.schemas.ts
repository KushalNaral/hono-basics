import "zod-openapi/extend";
import { z } from "zod";

export const AssetSelectSchema = z
  .object({
    id: z.string().openapi({
      example: "550e8400-e29b-41d4-a716-446655440000",
      description: "Unique asset identifier",
    }),
    resourceType: z.string().openapi({
      example: "roles",
      description: "Type of the parent resource",
    }),
    resourceId: z.string().openapi({
      example: "660e8400-e29b-41d4-a716-446655440000",
      description: "ID of the parent resource",
    }),
    filename: z.string().openapi({
      example: "a1b2c3d4.png",
      description: "Generated filename on disk",
    }),
    originalName: z.string().openapi({
      example: "profile-photo.png",
      description: "Original upload filename",
    }),
    mimeType: z.string().openapi({
      example: "image/png",
      description: "MIME type of the file",
    }),
    size: z.number().openapi({
      example: 102400,
      description: "File size in bytes",
    }),
    url: z.string().openapi({
      example: "/uploads/roles/660e8400/a1b2c3d4.png",
      description: "Public URL to access the file",
    }),
    createdAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "When the asset was uploaded",
    }),
    updatedAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "When the asset was last updated",
    }),
  })
  .openapi({ ref: "AssetSelect" });

export const AssetUploadResponseSchema = z
  .object({ data: AssetSelectSchema })
  .openapi({ ref: "AssetUploadResponse" });

export const BulkAssetUploadResponseSchema = z
  .object({ data: z.array(AssetSelectSchema) })
  .openapi({ ref: "BulkAssetUploadResponse" });

export const AssetRemoveResponseSchema = z
  .object({ success: z.boolean() })
  .openapi({ ref: "AssetRemoveResponse" });

export const BulkAssetRemoveResponseSchema = z
  .object({ removedCount: z.number() })
  .openapi({ ref: "BulkAssetRemoveResponse" });

export const AssetListResponseSchema = z
  .object({ data: z.array(AssetSelectSchema) })
  .openapi({ ref: "AssetListResponse" });
