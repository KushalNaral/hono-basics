import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import type { AuthVariables } from "@/lib/auth";
import { requireAuth } from "@/lib/auth";
import { rbac } from "@/lib/auth/rbac";
import { ErrorSchema, MePermissionsSchema } from "@/lib/auth/schemas";

const rbacRoutes = new Hono<{ Variables: AuthVariables }>();

/**
 * --- RBAC Routes ---
 * User-specific RBAC endpoint (not a generic CRUD operation).
 */

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
