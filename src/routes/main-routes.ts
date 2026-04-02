import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import { app } from "../app";
import { requireAuth } from "../lib/auth";
import { AuthResponseSchema, ErrorSchema } from "../lib/auth/schemas";

/**
 * Registers main routes for the application.
 * This includes basic profile and status checks.
 */
export function registerMainRoutes() {
  // 1. Welcome endpoint
  app.get(
    "/",
    describeRoute({
      summary: "Welcome endpoint",
      description:
        "A basic welcome endpoint that returns a personalized message if the user is authenticated, or a generic message otherwise.",
      responses: {
        200: {
          description: "Welcome message successfully retrieved",
          content: {
            "application/json": {
              schema: resolver(
                z.object({ message: z.string().openapi({ example: "Hello John Doe!" }) }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const user = c.get("user");
      if (user) {
        return c.json({ message: `Hello ${user.name}!` }, 200);
      }
      return c.json({ message: "Hello! Please sign in." }, 200);
    },
  );

  // 2. Get current session profile
  app.get(
    "/me",
    describeRoute({
      summary: "Get current session profile",
      description:
        "Retrieve user and session details for the currently authenticated user. This serves as a quick profile check.",
      responses: {
        200: {
          description: "User and session information successfully retrieved",
          content: {
            "application/json": {
              schema: resolver(AuthResponseSchema),
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
      const session = c.get("session");
      return c.json(
        {
          user: user as Record<string, unknown>,
          session: session as Record<string, unknown>,
        },
        200,
      );
    },
  );
}
