import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AuthVariables } from "@/lib/auth";
import { requireAuth, requirePermission } from "@/lib/auth";
import { rbac } from "@/lib/auth/rbac";
import {
  ErrorSchema,
  MePermissionsSchema,
  PermissionSchema,
  RoleWithPermissionsSchema,
} from "@/lib/auth/schemas";

const rbacRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

// Apply middlewares to specific paths
rbacRoutes.use("/permissions", requireAuth, requirePermission("view-permissions"));
rbacRoutes.use("/roles", requireAuth, requirePermission("view-roles"));
rbacRoutes.use("/me/permissions", requireAuth);

const getPermissionsRoute = createRoute({
  method: "get",
  path: "/permissions",
  summary: "List all permissions",
  description: "Retrieve a list of all available permissions in the system.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ permissions: z.array(PermissionSchema) }),
        },
      },
      description: "Successfully retrieved permissions",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Forbidden - missing permissions",
    },
  },
  security: [{ cookieAuth: [] }],
});

const getRolesRoute = createRoute({
  method: "get",
  path: "/roles",
  summary: "List all roles",
  description: "Retrieve a list of all roles and their assigned permissions.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ roles: z.array(RoleWithPermissionsSchema) }),
        },
      },
      description: "Successfully retrieved roles",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Forbidden - missing permissions",
    },
  },
  security: [{ cookieAuth: [] }],
});

const getMePermissionsRoute = createRoute({
  method: "get",
  path: "/me/permissions",
  summary: "Get current user permissions",
  description: "Retrieve the role and permissions for the currently authenticated user.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MePermissionsSchema,
        },
      },
      description: "Successfully retrieved current user permissions",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
  security: [{ cookieAuth: [] }],
});

rbacRoutes.openapi(getPermissionsRoute, async (c) => {
  const permissions = await rbac.getAllPermissions();
  const formattedPermissions = permissions.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
  return c.json({ permissions: formattedPermissions }, 200);
});

rbacRoutes.openapi(getRolesRoute, async (c) => {
  const roles = await rbac.getRolesWithPermissions();
  const formattedRoles = roles.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
  return c.json({ roles: formattedRoles }, 200);
});

rbacRoutes.openapi(getMePermissionsRoute, async (c) => {
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
});

export { rbacRoutes };
