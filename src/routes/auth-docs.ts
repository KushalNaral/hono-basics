import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import { app } from "../app";
import {
  AdminListUsersResponseSchema,
  AdminSetRoleInputSchema,
  AuthResponseSchema,
  ErrorSchema,
  SignInInputSchema,
  SignUpInputSchema,
} from "../lib/auth/schemas";

/**
 * Registers documentation for Better Auth routes.
 * These are "shadow routes" that only exist to provide OpenAPI metadata.
 * They are registered on the main app but will not be reached because
 * the Better Auth handler is registered earlier in index.ts.
 */
export function registerAuthDocs() {
  // 1. Sign Up
  app.post(
    "/api/auth/sign-up/email",
    describeRoute({
      summary: "Sign Up with Email",
      description:
        "Create a new user account using an email address and password. This endpoint sets a session cookie upon successful registration.",
      tags: ["Authentication"],
      responses: {
        200: {
          description: "Successful registration",
          content: {
            "application/json": { schema: resolver(AuthResponseSchema) },
          },
        },
        400: {
          description: "Invalid input or email already exists",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
    }),
    zValidator("json", SignUpInputSchema),
    async (c) => c.json({}, 200),
  );

  // 2. Sign In
  app.post(
    "/api/auth/sign-in/email",
    describeRoute({
      summary: "Sign In with Email",
      description:
        "Log in to an existing account using an email address and password. Sets a session cookie upon successful authentication.",
      tags: ["Authentication"],
      responses: {
        200: {
          description: "Successful login",
          content: {
            "application/json": { schema: resolver(AuthResponseSchema) },
          },
        },
        401: {
          description: "Invalid email or password",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
    }),
    zValidator("json", SignInInputSchema),
    async (c) => c.json({}, 200),
  );

  // 3. Sign Out
  app.post(
    "/api/auth/sign-out",
    describeRoute({
      summary: "Sign Out",
      description: "Invalidate the current session and clear the session cookie.",
      tags: ["Authentication"],
      responses: {
        200: {
          description: "Successful sign out",
        },
      },
    }),
    async (c) => c.json({}, 200),
  );

  // 4. Session
  app.get(
    "/api/auth/session",
    describeRoute({
      summary: "Get Current Session",
      description:
        "Retrieve information about the currently authenticated user and their active session. Requires a valid session cookie.",
      tags: ["Authentication"],
      responses: {
        200: {
          description: "Active session and user info",
          content: {
            "application/json": { schema: resolver(AuthResponseSchema) },
          },
        },
        401: {
          description: "No active session found",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    async (c) => c.json({}, 200),
  );

  // 5. Admin List Users
  app.get(
    "/api/auth/admin/list-users",
    describeRoute({
      summary: "List All Users (Admin)",
      description:
        "Retrieve a paginated list of all registered users. Requires 'admin' role or appropriate permissions.",
      tags: ["Admin"],
      responses: {
        200: {
          description: "List of users successfully retrieved",
          content: {
            "application/json": {
              schema: resolver(AdminListUsersResponseSchema),
            },
          },
        },
        403: {
          description: "Forbidden - Requires admin privileges",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    async (c) => c.json({}, 200),
  );

  // 6. Admin Set Role
  app.post(
    "/api/auth/admin/set-role",
    describeRoute({
      summary: "Set User Role (Admin)",
      description: "Update the role assigned to a specific user. Requires 'admin' role.",
      tags: ["Admin"],
      responses: {
        200: {
          description: "Role updated successfully",
        },
        403: {
          description: "Forbidden - Requires admin privileges",
          content: { "application/json": { schema: resolver(ErrorSchema) } },
        },
      },
      security: [{ cookieAuth: [] }],
    }),
    zValidator("json", AdminSetRoleInputSchema),
    async (c) => c.json({}, 200),
  );
}
