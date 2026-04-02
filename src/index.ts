import { swaggerUI } from "@hono/swagger-ui";
import { auth, sessionMiddleware } from "@/lib/auth";
import { app } from "./app";
import { registerAuthDocs } from "./routes/auth-docs";
import { registerMainRoutes } from "./routes/main-routes";
import { rbacRoutes } from "./routes/rbac-routes";

/**
 * --- Application Entry Point ---
 * Orchestrates middleware, routes, and documentation.
 */

// 1. Better Auth handler (Caught before session middleware)
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// 2. Global Middlewares
app.use("*", sessionMiddleware);

// 3. Documentation Setup
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Hono Basics API",
    version: "1.0.0",
    description: "A secure API built with Hono, Better Auth, and Drizzle ORM.",
  },
  servers: [{ url: "http://localhost:3000" }],
});

app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "better-auth.session_token",
  description: "Session token stored in a cookie.",
});

app.get("/doc", swaggerUI({ url: "/openapi.json" }));

// 4. Route Registration
registerMainRoutes();
registerAuthDocs();
app.route("/api/rbac", rbacRoutes);

export default app;
