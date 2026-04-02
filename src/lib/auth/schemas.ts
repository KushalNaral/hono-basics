import { z } from "@hono/zod-openapi";

export const PermissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  groupName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RoleSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RoleWithPermissionsSchema = RoleSchema.extend({
  permissions: z.array(z.string()),
});

export const ErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  missing: z.array(z.string()).optional(),
});

export const MePermissionsSchema = z.object({
  role: z.string(),
  permissions: z.array(z.string()),
});

export const SignUpInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string(),
});

export const SignInInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string().optional(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.string(),
  token: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  session: SessionSchema,
});

export const AdminListUsersResponseSchema = z.object({
  users: z.array(UserSchema),
});

export const AdminSetRoleInputSchema = z.object({
  userId: z.string(),
  role: z.string(),
});
