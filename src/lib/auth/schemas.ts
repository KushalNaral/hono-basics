import "zod-openapi/extend";
import { z } from "zod";

/**
 * Zod schemas with OpenAPI metadata.
 * Using zod-openapi@4 as recommended by HonoHub.
 */

export const PermissionSchema = z
  .object({
    id: z.string().openapi({
      example: "123e4567-e89b-12d3-a456-426614174000",
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
      description: "The timestamp when the permission was created",
    }),
    updatedAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "The timestamp when the permission was last updated",
    }),
  })
  .openapi({ ref: "Permission" });

export const RoleSchema = z
  .object({
    name: z.string().openapi({ example: "admin", description: "Unique internal name of the role" }),
    description: z.string().nullable().openapi({
      example: "Full system access",
      description: "Human-readable description of the role",
    }),
    createdAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "The timestamp when the role was created",
    }),
    updatedAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "The timestamp when the role was last updated",
    }),
  })
  .openapi({ ref: "Role" });

export const RoleWithPermissionsSchema = RoleSchema.extend({
  permissions: z.array(z.string()).openapi({ example: ["list-users", "view-users"] }),
}).openapi({ ref: "RoleWithPermissions" });

export const ErrorSchema = z
  .object({
    error: z
      .string()
      .openapi({ example: "Forbidden", description: "The error type or status code name" }),
    message: z.string().optional().openapi({
      example: "Missing permissions: list-users",
      description: "A detailed error message providing more context",
    }),
    missing: z
      .array(z.string())
      .optional()
      .openapi({
        example: ["list-users"],
        description: "A list of missing permissions or fields that caused the error",
      }),
  })
  .openapi({ ref: "Error" });

export const MePermissionsSchema = z
  .object({
    role: z.string().openapi({ example: "admin", description: "The current user's assigned role" }),
    permissions: z.array(z.string()).openapi({
      example: ["list-users", "view-users"],
      description: "A list of permission names granted to the user",
    }),
  })
  .openapi({ ref: "MePermissions" });

export const SignUpInputSchema = z
  .object({
    email: z.string().email().openapi({
      example: "user@example.com",
      description: "The email address for the new account",
    }),
    password: z.string().min(8).openapi({
      example: "Password123!",
      description: "The password for the new account (min 8 characters)",
    }),
    name: z.string().openapi({ example: "John Doe", description: "The full name of the user" }),
  })
  .openapi({ ref: "SignUpInput" });

export const SignInInputSchema = z
  .object({
    email: z
      .string()
      .email()
      .openapi({ example: "user@example.com", description: "The user's registered email address" }),
    password: z
      .string()
      .openapi({ example: "Password123!", description: "The user's account password" }),
  })
  .openapi({ ref: "SignInInput" });

export const UserSchema = z
  .object({
    id: z
      .string()
      .openapi({ example: "user_123", description: "The unique identifier for the user" }),
    email: z
      .string()
      .email()
      .openapi({ example: "user@example.com", description: "The user's email address" }),
    name: z.string().openapi({ example: "John Doe", description: "The user's full name" }),
    role: z
      .string()
      .optional()
      .openapi({ example: "admin", description: "The assigned role of the user" }),
    emailVerified: z
      .boolean()
      .openapi({ example: true, description: "Whether the user's email is verified" }),
    image: z.string().nullable().optional().openapi({
      example: "https://example.com/avatar.png",
      description: "The user's profile picture URL",
    }),
    createdAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "The timestamp when the user was created",
    }),
    updatedAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "The timestamp when the user was last updated",
    }),
  })
  .openapi({ ref: "User" });

export const SessionSchema = z
  .object({
    id: z
      .string()
      .openapi({ example: "sess_123", description: "The unique identifier for the session" }),
    userId: z.string().openapi({
      example: "user_123",
      description: "The ID of the user associated with this session",
    }),
    expiresAt: z.string().openapi({
      example: "2024-04-27T10:00:00Z",
      description: "The timestamp when the session expires",
    }),
    token: z.string().openapi({
      example: "abc-def-123",
      description: "The session token used for authentication",
    }),
    createdAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "The timestamp when the session was created",
    }),
    updatedAt: z.string().openapi({
      example: "2024-03-27T10:00:00Z",
      description: "The timestamp when the session was last updated",
    }),
  })
  .openapi({ ref: "Session" });

export const AuthResponseSchema = z
  .object({
    user: UserSchema,
    session: SessionSchema,
  })
  .openapi({ ref: "AuthResponse" });

export const AdminListUsersResponseSchema = z
  .object({
    users: z.array(UserSchema),
  })
  .openapi({ ref: "AdminListUsersResponse" });

export const AdminSetRoleInputSchema = z
  .object({
    userId: z.string().openapi({ example: "user_123" }),
    role: z.string().openapi({ example: "admin" }),
  })
  .openapi({ ref: "AdminSetRoleInput" });
