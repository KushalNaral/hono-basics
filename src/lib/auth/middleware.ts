import { and, eq, inArray } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { permission, rolePermission } from "@/db/schema";
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

    const userRole = (user as AuthUser & { role?: string }).role ?? "user";

    // Admin role bypasses all permission checks if desired, but here we check explicitly
    // to ensure the DB-backed RBAC remains the source of truth even for admins.
    const result = await db
      .select({ name: permission.name })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(and(eq(rolePermission.role, userRole), inArray(permission.name, requiredPermissions)));

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
