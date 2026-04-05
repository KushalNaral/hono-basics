import "zod-openapi/extend";
import { z } from "zod";

export const PermissionSelectSchema = z
  .object({
    id: z.string().openapi({
      example: "550e8400-e29b-41d4-a716-446655440000",
      description: "The unique identifier for the permission",
    }),
    name: z
      .string()
      .openapi({ example: "list-users", description: "Unique name of the permission" }),
    groupName: z
      .string()
      .openapi({ example: "users", description: "Resource group for this permission" }),
    createdAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "When the permission was created",
    }),
    updatedAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "When the permission was last updated",
    }),
  })
  .openapi({ ref: "PermissionSelect" });

export const PermissionInsertSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .openapi({ example: "list-users", description: "Unique name for the permission" }),
    groupName: z
      .string()
      .min(1)
      .max(50)
      .openapi({ example: "users", description: "Resource group name" }),
  })
  .openapi({ ref: "PermissionInsert" });

export const PermissionUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .openapi({ example: "list-users", description: "New name for the permission" }),
    groupName: z
      .string()
      .min(1)
      .max(50)
      .optional()
      .openapi({ example: "users", description: "New resource group name" }),
  })
  .openapi({ ref: "PermissionUpdate" });
