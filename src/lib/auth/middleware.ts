import type { Context, MiddlewareHandler } from "hono";
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
