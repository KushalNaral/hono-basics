import { Hono } from "hono";
import type { AuthVariables } from "@/lib/auth";
import { auth, requireAuth, sessionMiddleware } from "@/lib/auth";

const app = new Hono<{ Variables: AuthVariables }>();

// Auth handler — must be before session middleware to avoid circular calls
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Session middleware for all other routes
app.use("*", sessionMiddleware);

app.get("/", (c) => {
  const user = c.get("user");
  if (user) {
    return c.json({ message: `Hello ${user.name}!`, user });
  }
  return c.json({ message: "Hello! Please sign in." });
});

app.get("/me", requireAuth, (c) => {
  return c.json({ user: c.get("user"), session: c.get("session") });
});

export default app;
