import { swaggerUI } from "@hono/swagger-ui";
import { serveStatic } from "hono/bun";
import { openAPIRouteHandler } from "hono-openapi";
import { auth, sessionMiddleware } from "@/lib/auth";
import { app } from "./app";
import { registerAuthDocs } from "./routes/auth-docs";
import { registerCrudRoutes } from "./routes/crud-registration";
import { registerMainRoutes } from "./routes/main-routes";
import { rbacRoutes } from "./routes/rbac-routes";

/**
 * --- Application Entry Point ---
 * Orchestrates middleware, routes, and documentation.
 * Uses hono-openapi (Rhinobase) architecture.
 */

// 1. Better Auth handler (Caught before session middleware)
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// 2. Global Middlewares
app.use("*", sessionMiddleware);

// 3. Documentation Setup
// Generate the OpenAPI JSON spec
app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
    documentation: {
      components: {
        securitySchemes: {
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
            description: "Session token stored in a cookie.",
          },
        },
      },
      info: {
        title: "Hono Basics API",
        version: "1.0.0",
        description: "A secure API built with Hono, Better Auth, and Drizzle ORM.",
      },
      servers: [{ url: "http://localhost:3000" }],
    },
  }),
);

// Serve Swagger UI
app.get("/doc", swaggerUI({ url: "/openapi.json" }));

// 4. Static File Serving (uploads)
app.use("/uploads/*", serveStatic({ root: "./" }));

// 5. Route Registration
registerMainRoutes();
registerAuthDocs();
registerCrudRoutes();
app.route("/api/rbac", rbacRoutes);

export default app;
