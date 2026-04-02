import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import type { AuthVariables } from "@/lib/auth";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rbac } from "@/lib/auth/rbac";
import {
  ErrorSchema,
  MePermissionsSchema,
  PermissionSchema,
  RoleWithPermissionsSchema,
} from "@/lib/auth/schemas";

const rbacRoutes = new Hono<{ Variables: AuthVariables }>();

/**
 * --- RBAC Routes ---
 * Exposes roles and permissions for the dashboard.
 */

// 1. List all permissions
rbacRoutes.get(
  "/permissions",
  describeRoute({
    summary: "List all permissions",
    description:
      "Retrieve a comprehensive list of all available permissions in the system, grouped by resource (e.g., users, roles). This is typically used in admin dashboards to manage role assignments.",
    responses: {
      200: {
        description: "Successfully retrieved the list of permissions",
        content: {
          "application/json": {
            schema: resolver(z.object({ permissions: z.array(PermissionSchema) })),
          },
        },
      },
      403: {
        description: "Forbidden - Requires 'view-permissions' permission",
        content: {
          "application/json": {
            schema: resolver(ErrorSchema),
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  }),
  requireAuth,
  requirePermission("view-permissions"),
  async (c) => {
    const permissions = await rbac.getAllPermissions();
    const formattedPermissions = permissions.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
    return c.json({ permissions: formattedPermissions }, 200);
  },
);

// 2. List all roles
rbacRoutes.get(
  "/roles",
  describeRoute({
    summary: "List all roles",
    description:
      "Retrieve a list of all defined roles in the system, including their associated permission names. Useful for role-based access management.",
    responses: {
      200: {
        description: "Successfully retrieved the list of roles with permissions",
        content: {
          "application/json": {
            schema: resolver(z.object({ roles: z.array(RoleWithPermissionsSchema) })),
          },
        },
      },
      403: {
        description: "Forbidden - Requires 'view-roles' permission",
        content: {
          "application/json": {
            schema: resolver(ErrorSchema),
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  }),
  requireAuth,
  requirePermission("view-roles"),
  async (c) => {
    const roles = await rbac.getRolesWithPermissions();
    const formattedRoles = roles.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
    return c.json({ roles: formattedRoles }, 200);
  },
);

// 3. Get current user permissions
rbacRoutes.get(
  "/me/permissions",
  describeRoute({
    summary: "Get current user permissions",
    description:
      "Retrieve the role and granular permissions for the currently authenticated user session. This is used by the frontend to conditionally render UI elements based on access levels.",
    responses: {
      200: {
        description: "Successfully retrieved the current user's role and permissions",
        content: {
          "application/json": {
            schema: resolver(MePermissionsSchema),
          },
        },
      },
      401: {
        description: "Unauthorized - No active session",
        content: {
          "application/json": {
            schema: resolver(ErrorSchema),
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized", message: "User not found in session" }, 401);
    }

    const role = user.role || "user";
    const permissions = await rbac.getPermissionsByRole(role);

    return c.json(
      {
        role,
        permissions: permissions.map((p) => p.name),
      },
      200,
    );
  },
);

export { rbacRoutes };
