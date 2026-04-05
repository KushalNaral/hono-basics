import "zod-openapi/extend";
import { z } from "zod";

export const ImageInfoSchema = z
  .object({
    id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    filename: z.string().openapi({ example: "550e8400.png" }),
    path: z.string().openapi({ example: "/uploads/roles/abc123/550e8400.png" }),
    url: z.string().openapi({ example: "/uploads/roles/abc123/550e8400.png" }),
  })
  .openapi({ ref: "ImageInfo" });

export const ImageUploadResponseSchema = z
  .object({ data: ImageInfoSchema })
  .openapi({ ref: "ImageUploadResponse" });

export const BulkImageUploadResponseSchema = z
  .object({ data: z.array(ImageInfoSchema) })
  .openapi({ ref: "BulkImageUploadResponse" });

export const ImageRemoveResponseSchema = z
  .object({ success: z.boolean() })
  .openapi({ ref: "ImageRemoveResponse" });

export const BulkImageRemoveResponseSchema = z
  .object({ removedCount: z.number() })
  .openapi({ ref: "BulkImageRemoveResponse" });
