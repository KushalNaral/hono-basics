import { and, eq, inArray } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { permission, role, rolePermission } from "@/db/schema";
import { db } from "@/lib/db";
import { auth } from "./auth";
import type { AppRole } from "./permissions";

type AuthSession = typeof auth.$Infer.Session.session;
type AuthUser = typeof auth.$Infer.Session.user;

export interface AuthVariables {
  user: AuthUser | null;
  session: AuthSession | null;
}

export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);

  await next();
};

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};

export function requireRole(...allowedRoles: AppRole[]): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = c.get("user") as AuthUser | null;

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userRole = (user as AuthUser & { role?: string }).role ?? "user";

    if (!allowedRoles.includes(userRole as AppRole)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await next();
  };
}

/**
 * Middleware that checks if the user's role has the required permission(s).
 * Permissions are looked up from the DB (permission + role_permission tables).
 * Joins through the role table using role.name to match the user's role string.
 *
 * Usage: `app.get("/admin/settings", requirePermission("manage-settings"), handler)`
 */
export function requirePermission(...requiredPermissions: string[]): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = c.get("user") as AuthUser | null;

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (requiredPermissions.length === 0) {
      await next();
      return;
    }

    const roleId = (user as AuthUser & { roleId?: string }).roleId;
    const userRole = (user as AuthUser & { role?: string }).role ?? "user";

    const query = db
      .select({ name: permission.name })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id));

    if (roleId) {
      query.where(
        and(eq(rolePermission.roleId, roleId), inArray(permission.name, requiredPermissions)),
      );
    } else {
      // Fallback to role name join if roleId is not present
      query
        .innerJoin(role, eq(rolePermission.roleId, role.id))
        .where(and(eq(role.name, userRole), inArray(permission.name, requiredPermissions)));
    }

    const result = await query;
    const foundPermissions = new Set(result.map((r) => r.name));
    const missing = requiredPermissions.filter((p) => !foundPermissions.has(p));

    if (missing.length > 0) {
      return c.json(
        {
          error: "Forbidden",
          message: `Missing permissions: ${missing.join(", ")}`,
          missing,
        },
        403,
      );
    }

    await next();
  };
}
