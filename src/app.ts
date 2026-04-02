import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthVariables } from "@/lib/auth";

/**
 * Main application instance.
 * Decoupled from the entry point to avoid initialization races during testing.
 */
export const app = new OpenAPIHono<{ Variables: AuthVariables }>();
