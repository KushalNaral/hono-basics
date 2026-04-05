import "zod-openapi/extend";
import { z } from "zod";
import { AssetSelectSchema } from "@/assets";

export const RoleSelectSchema = z
  .object({
    id: z.string().openapi({
      example: "550e8400-e29b-41d4-a716-446655440000",
      description: "The unique identifier for the role",
    }),
    name: z.string().openapi({ example: "admin", description: "Unique name of the role" }),
    description: z.string().nullable().openapi({
      example: "Full system access",
      description: "Human-readable description of the role",
    }),
    createdAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "When the role was created",
    }),
    updatedAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "When the role was last updated",
    }),
  })
  .openapi({ ref: "RoleSelect" });

export const RoleExpandedSchema = RoleSelectSchema.extend({
  permissions: z.array(z.string()).openapi({
    example: ["list-users", "view-users", "create-users"],
    description: "Permission names assigned to this role",
  }),
  assets: z.array(AssetSelectSchema).openapi({
    description: "Assets attached to this role",
  }),
}).openapi({ ref: "RoleExpanded" });

export const RoleInsertSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(50)
      .openapi({ example: "editor", description: "Unique name for the role" }),
    description: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "Content editor role", description: "Description of the role" }),
    permissions: z
      .array(z.string())
      .optional()
      .openapi({
        example: ["list-users", "view-users"],
        description: "Permission names to assign to the role",
      }),
  })
  .openapi({ ref: "RoleInsert" });

export const RoleUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(50)
      .optional()
      .openapi({ example: "editor", description: "New name for the role" }),
    description: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "Updated description", description: "New description" }),
    permissions: z
      .array(z.string())
      .optional()
      .openapi({
        example: ["list-users", "view-users"],
        description: "Permission names to assign (replaces existing)",
      }),
  })
  .openapi({ ref: "RoleUpdate" });
