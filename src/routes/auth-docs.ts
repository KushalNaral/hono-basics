import { createRoute, z } from "@hono/zod-openapi";
import { app } from "../app";
import {
  AdminListUsersResponseSchema,
  AdminSetRoleInputSchema,
  AuthResponseSchema,
  ErrorSchema,
  SignInInputSchema,
  SignUpInputSchema,
} from "../lib/auth/schemas";

// --- Route Definitions ---

export const signUpRoute = createRoute({
  method: "post",
  path: "/api/auth/sign-up/email",
  summary: "Sign Up with Email",
  tags: ["Authentication"],
  request: {
    body: {
      content: { "application/json": { schema: SignUpInputSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "Successful registration",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid input",
    },
  },
});

export const signInRoute = createRoute({
  method: "post",
  path: "/api/auth/sign-in/email",
  summary: "Sign In with Email",
  tags: ["Authentication"],
  request: {
    body: {
      content: { "application/json": { schema: SignInInputSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "Successful login",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid credentials",
    },
  },
});

export const signOutRoute = createRoute({
  method: "post",
  path: "/api/auth/sign-out",
  summary: "Sign Out",
  tags: ["Authentication"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
      description: "Successful sign out",
    },
  },
});

export const sessionRoute = createRoute({
  method: "get",
  path: "/api/auth/session",
  summary: "Get Current Session",
  tags: ["Authentication"],
  responses: {
    200: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "Active session info",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "No active session",
    },
  },
});

export const adminListUsersRoute = createRoute({
  method: "get",
  path: "/api/auth/admin/list-users",
  summary: "List All Users (Admin)",
  tags: ["Admin"],
  responses: {
    200: {
      content: { "application/json": { schema: AdminListUsersResponseSchema } },
      description: "List of users",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Forbidden",
    },
  },
  security: [{ cookieAuth: [] }],
});

export const adminSetRoleRoute = createRoute({
  method: "post",
  path: "/api/auth/admin/set-role",
  summary: "Set User Role (Admin)",
  tags: ["Admin"],
  request: {
    body: {
      content: { "application/json": { schema: AdminSetRoleInputSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
      description: "Role updated successfully",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Forbidden",
    },
  },
  security: [{ cookieAuth: [] }],
});

/**
 * Registers documentation for Better Auth routes.
 * These are "docs only" to avoid body consumption conflicts in Hono.
 */
export function registerAuthDocs() {
  app.openAPIRegistry.registerPath(signUpRoute);
  app.openAPIRegistry.registerPath(signInRoute);
  app.openAPIRegistry.registerPath(signOutRoute);
  app.openAPIRegistry.registerPath(sessionRoute);
  app.openAPIRegistry.registerPath(adminListUsersRoute);
  app.openAPIRegistry.registerPath(adminSetRoleRoute);
}
