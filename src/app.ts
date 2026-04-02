import { Hono } from "hono";
import type { AuthVariables } from "@/lib/auth";

/**
 * Main application instance using standard Hono.
 * Decoupled from the entry point to avoid initialization races during testing.
 * Compatible with hono-openapi (Rhinobase) for documentation.
 */
export const app = new Hono<{ Variables: AuthVariables }>();
