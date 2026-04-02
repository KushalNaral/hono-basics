import { createRoute, z } from "@hono/zod-openapi";
import { app } from "../app";
import { requireAuth } from "../lib/auth";
import { ErrorSchema } from "../lib/auth/schemas";

// --- Route Definitions ---

export const rootRoute = createRoute({
  method: "get",
  path: "/",
  summary: "Welcome endpoint",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
      description: "Welcome message",
    },
  },
});

export const meRoute = createRoute({
  method: "get",
  path: "/me",
  summary: "Get current session profile",
  description: "Retrieve user and session details for the authenticated user.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            user: z.record(z.unknown()),
            session: z.record(z.unknown()),
          }),
        },
      },
      description: "User and session information",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthorized",
    },
  },
  security: [{ cookieAuth: [] }],
});

/**
 * Registers main routes for the application.
 * This includes basic profile and status checks.
 */
export function registerMainRoutes() {
  app.use("/me", requireAuth);

  app.openapi(rootRoute, (c) => {
    const user = c.get("user");
    if (user) {
      return c.json({ message: `Hello ${user.name}!` }, 200);
    }
    return c.json({ message: "Hello! Please sign in." }, 200);
  });

  app.openapi(meRoute, (c) => {
    const user = c.get("user");
    const session = c.get("session");
    return c.json(
      {
        user: user as Record<string, unknown>,
        session: session as Record<string, unknown>,
      },
      200,
    );
  });
}
