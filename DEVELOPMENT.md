# Development Guide

This guide covers day-to-day development workflows, architecture decisions, and how to extend the application.

## Table of Contents

- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Adding a New Resource](#adding-a-new-resource)
- [Authentication & Authorization](#authentication--authorization)
- [Database Workflow](#database-workflow)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Image Uploads](#image-uploads)
- [Troubleshooting](#troubleshooting)

---

## Development Setup

### First-time setup

```sh
# Install dependencies
bun install

# Copy environment config
cp .env.example .env

# Start PostgreSQL (dev)
docker compose up db -d --wait

# Run migrations
bun run db:migrate

# Seed initial roles and permissions
bun run db:seed

# Start dev server (hot reload)
bun run dev
```

### Test database

Tests use a separate PostgreSQL instance on port 5434:

```sh
# Start test DB
docker compose up db-test -d --wait

# Run tests (migrations applied automatically via tests/setup.ts)
bun run test
```

Or use the combined command:

```sh
bun run test:docker
```

### Path aliases

The project uses `@/*` as a path alias for `src/*`:

```typescript
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { permission } from "@/db/schema";
```

This is configured in `tsconfig.json` and works with Bun's module resolution.

---

## Architecture Overview

### Request Flow

```
Request
  -> Better Auth handler (catches /api/auth/*)
  -> Session middleware (populates user/session on context)
  -> Route handler
    -> Permission middleware (checks RBAC)
    -> Controller logic
    -> Response
```

### Key Design Decisions

**Decoupled app instance** (`src/app.ts`): The Hono app is created separately from the entry point (`src/index.ts`) to avoid initialization races during testing. Tests import `app` directly and call `app.fetch()` without starting a server.

**Generic CRUD factory**: Instead of writing routes for each resource, `createCrudRoutes()` generates all standard endpoints from a `ResourceConfig`. This eliminates boilerplate and ensures consistent behavior across resources.

**Better Auth hooks**: The `databaseHooks.user.create.after` hook automatically syncs the `roleId` foreign key when a user is created. The `update.before` hook syncs it when the role string is changed. This keeps the `role` string (used by Better Auth's admin plugin) and `roleId` FK (used by our RBAC queries) in sync.

**Permission-based access control**: Authorization uses a two-layer approach:
1. Better Auth's admin plugin handles role-level access (admin, moderator, user) for auth endpoints
2. The `requirePermission` middleware checks fine-grained permissions from the `role_permission` table for CRUD endpoints

---

## Adding a New Resource

Follow this pattern to add a new CRUD resource (e.g., "categories").

### 1. Create the database schema

Add the table definition in `src/db/schema/`:

```typescript
// src/db/schema/category-schema.ts
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const category = pgTable("category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

Export it from `src/db/schema/index.ts`:

```typescript
export * from "./category-schema";
```

### 2. Generate and run migration

```sh
bun run db:generate
bun run db:migrate
```

### 3. Create Zod schemas

```typescript
// src/resources/categories/category.schemas.ts
import "zod-openapi/extend";
import { z } from "zod";

export const CategorySelectSchema = z
  .object({
    id: z.string().openapi({ example: "uuid-here" }),
    name: z.string().openapi({ example: "Electronics" }),
    description: z.string().nullable().openapi({ example: "Electronic goods" }),
    createdAt: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
    updatedAt: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
  })
  .openapi({ ref: "CategorySelect" });

export const CategoryInsertSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
  })
  .openapi({ ref: "CategoryInsert" });

export const CategoryUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
  })
  .openapi({ ref: "CategoryUpdate" });
```

### 4. Create the service

For simple resources, use `createBaseService` directly:

```typescript
// src/resources/categories/category.service.ts
import { createBaseService } from "@/crud/base-service";
import { category } from "@/db/schema";

export type CategorySelect = typeof category.$inferSelect;
export type CategoryInsert = typeof category.$inferInsert;

export const categoryService = createBaseService<
  typeof category,
  CategorySelect,
  CategoryInsert,
  string
>({
  table: category,
  primaryKey: category.id,
  filterableColumns: { name: category.name },
  sortableColumns: { name: category.name, createdAt: category.createdAt },
});
```

For resources that need custom logic (like roles with permission syncing), spread the base service and override specific methods. See `src/resources/roles/role.service.ts` for an example.

### 5. Create the resource config

```typescript
// src/resources/categories/category.config.ts
import type { ResourceConfig } from "@/crud/types";
import { CategoryInsertSchema, CategorySelectSchema, CategoryUpdateSchema } from "./category.schemas";
import type { CategoryInsert, CategorySelect } from "./category.service";
import { categoryService } from "./category.service";

export const categoryConfig: ResourceConfig<CategorySelect, CategoryInsert, string> = {
  name: "categories",
  basePath: "/api/categories",
  idParam: "id",
  service: categoryService,
  schemas: {
    select: CategorySelectSchema,
    insert: CategoryInsertSchema,
    update: CategoryUpdateSchema,
  },
  permissions: {
    all: "list-categories",
    list: "list-categories",
    getById: "view-categories",
    create: "create-categories",
    update: "update-categories",
    delete: "delete-categories",
    bulkCreate: "create-categories",
    bulkUpdate: "update-categories",
    bulkDelete: "delete-categories",
  },
  tags: ["Categories"],
};
```

### 6. Register the routes

In `src/routes/crud-registration.ts`:

```typescript
import { categoryConfig } from "@/resources/categories/category.config";

export function registerCrudRoutes() {
  // ... existing registrations ...
  app.route(categoryConfig.basePath, createCrudRoutes(categoryConfig));
}
```

### 7. Add permissions to the seed

In `src/db/seed/role-permission.seed.ts`, add the new permission group:

```typescript
const permissions = {
  // ... existing ...
  categories: ["list-categories", "view-categories", "create-categories", "update-categories", "delete-categories"],
};
```

And assign them to roles in `roleAssignments`.

Then re-run the seed:

```sh
bun run db:seed
```

### 8. Write tests

Create `tests/crud/categories.test.ts` following the pattern in `tests/crud/permissions.test.ts`.

---

## Authentication & Authorization

### How auth works

Better Auth handles user registration, login, sessions, and admin operations. Session tokens are stored in cookies (`better-auth.session_token`).

The `sessionMiddleware` (applied globally) reads the cookie and populates `c.var.user` and `c.var.session` on every request. Protected routes then check these values.

### Middleware chain

```typescript
// Public route - only needs session middleware (global)
app.get("/", handler);

// Authenticated route
app.get("/me", requireAuth, handler);

// Role-gated route
app.get("/admin", requireRole("admin"), handler);

// Permission-gated route
app.get("/users", requirePermission("list-users"), handler);
```

### How roleId sync works

When a user signs up:

1. Better Auth creates the user with `role: "user"` (from admin plugin default)
2. The `create.after` database hook fires
3. It looks up the `role` table for a row matching the role name
4. It updates the user's `roleId` FK with the matching role's UUID

When an admin changes a user's role via `/api/auth/admin/set-role`:

1. The `update.before` hook fires with the new `role` value
2. It looks up the corresponding role UUID
3. It adds `roleId` to the update data

### Adding a new role

1. Add the role definition in `src/lib/auth/permissions.ts`:

```typescript
export const roles = {
  // ... existing ...
  editor: ac.newRole({
    user: ["read"],
    session: ["list"],
  }),
};
```

2. Add it to the seed in `src/db/seed/role-permission.seed.ts`
3. Run `bun run db:seed`

---

## Database Workflow

### Generating migrations

After changing any file in `src/db/schema/`:

```sh
# Generate migration SQL
bun run db:generate

# Review the generated file in drizzle/
# Then apply it
bun run db:migrate
```

### Schema conventions

- All table IDs are `text` with `.$defaultFn(() => crypto.randomUUID())`
- Timestamps use `timestamp` with `.defaultNow()` and `.$onUpdate(() => new Date())`
- Foreign keys use `.references(() => table.column)` with appropriate cascade rules
- Relations are defined separately using Drizzle's `relations()` function

### Seeding

The seed script (`bun run db:seed`) is idempotent: it upserts roles and permissions, then syncs role-permission assignments. Safe to run multiple times.

### Direct DB access

```sh
# Open Drizzle Studio (visual DB browser)
bun run db:studio

# Push schema directly (skips migrations, useful for prototyping)
bun run db:push
```

---

## Testing

### Running tests

```sh
# Start test DB if not running
docker compose up db-test -d --wait

# Run all tests
bun run test

# Run a specific test file
bun test --preload ./tests/setup.ts tests/crud/crud.test.ts
```

### Test architecture

- `tests/setup.ts` runs before all test files (via `--preload`). It drops and recreates the public schema, then runs all migrations.
- Each test file's `beforeAll` cleans relevant tables and seeds its own data. This ensures test isolation.
- Tests call `app.fetch()` directly without starting an HTTP server.

### Writing tests

Key patterns used across all test files:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { seedRolePermissions } from "@/db/seed/role-permission.seed";
import app from "@/index";
import { createEnv } from "@/lib/env";

const env = createEnv(process.env);
const BASE_URL = `http://localhost:${env.APP_PORT}`;

let pool: Pool;
let db: ReturnType<typeof drizzle>;
let adminCookie = "";

// Typed response interfaces
interface MyResponse {
  id: string;
  name: string;
}

// Typed JSON helper (avoids `any`)
async function jsonBody<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// Request helper that sets Content-Type
async function authRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const req = new Request(`${BASE_URL}${path}`, { ...options, headers });
  return app.fetch(req);
}

describe("My Resource", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: env.DB_URL });
    db = drizzle(pool);

    // Clean tables in FK-safe order
    await db.execute(sql`DELETE FROM "two_factor"`);
    await db.execute(sql`DELETE FROM "account"`);
    await db.execute(sql`DELETE FROM "session"`);
    await db.execute(sql`DELETE FROM "role_permission"`);
    await db.execute(sql`DELETE FROM "user"`);
    await db.execute(sql`DELETE FROM "permission"`);
    await db.execute(sql`DELETE FROM "role"`);

    // @ts-expect-error - drizzle type mismatch
    await seedRolePermissions(db);

    // Create and authenticate an admin user
    await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@test.com",
        password: "Password123!",
        name: "Admin",
      }),
    });
    await db.execute(
      sql`UPDATE "user" SET role = 'admin', role_id = (SELECT id FROM "role" WHERE name = 'admin') WHERE email = 'admin@test.com'`,
    );
    const loginRes = await authRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "admin@test.com", password: "Password123!" }),
    });
    adminCookie = loginRes.headers.get("set-cookie") || "";
  });

  afterAll(async () => {
    await pool.end();
  });

  it("should do something", async () => {
    const res = await authRequest("/api/my-resource", {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<{ data: MyResponse[] }>(res);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
```

### Table cleanup order

When deleting test data, always respect FK constraints:

```
asset -> two_factor -> account -> session -> role_permission -> user -> permission -> role
```

Delete in this order (left to right) to avoid foreign key violations.

---

## Code Quality

### Linting and formatting

```sh
# Check everything (TypeScript + Biome)
bun run check

# Lint only
bun run lint

# Lint and auto-fix
bun run lint:fix

# Format
bun run format
```

### Strict rules

The project enforces zero warnings:

- **No `any` types**: Use `as never` for Drizzle type casts, `as unknown as T` for other unavoidable casts, or add proper type parameters
- **No non-null assertions (`!`)**: Use `?? ""` for route params, `?? null` for optional values, or add an explicit null check
- **Cognitive complexity <= 15**: Extract helper functions when handlers get complex
- **No unused imports or variables**: Biome reports these as errors

### Type patterns

```typescript
// Route params (instead of c.req.param("id")!)
const id = c.req.param("id") ?? "";

// Array access (instead of rows[0]!)
const row = rows[0];
if (!row) throw new Error("Expected a row");

// Drizzle generic table operations (instead of `as any`)
db.insert(table as never).values(data as never).returning();
const result = (await query) as TSelect[];

// Typed JSON responses in tests (instead of `any`)
async function jsonBody<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}
const body = await jsonBody<{ data: MyType[] }>(res);
```

---

## Asset System

The asset system provides database-tracked file uploads with a polymorphic relation to any parent entity. Every uploaded file gets a row in the `asset` table with full metadata.

### How it works

1. **Upload**: File is written to `uploads/{resourceType}/{resourceId}/{uuid}.ext`, then an `asset` row is inserted with metadata (original name, MIME type, size, URL).
2. **List**: Query `asset WHERE resource_type = ? AND resource_id = ?`.
3. **Update**: Old file is deleted from disk, new file is written, DB row is updated.
4. **Delete**: DB row is deleted first, then the file is removed from disk.
5. **Resource integration**: When a resource is fetched (e.g. `GET /api/roles/:id`), its assets are included in the response automatically.
6. **Cascade cleanup**: When a parent resource is deleted, all its assets are cleaned up (both DB rows and files).

### The `asset` table

```
asset
  id             text PK (UUID)
  resource_type  text NOT NULL     -- "roles", "posts", etc.
  resource_id    text NOT NULL     -- UUID of the parent entity
  filename       text NOT NULL     -- generated filename on disk
  original_name  text NOT NULL     -- user's original filename
  mime_type      text NOT NULL     -- image/png, application/pdf, etc.
  size           integer NOT NULL  -- bytes
  url            text NOT NULL     -- /uploads/roles/{id}/{filename}
  created_at     timestamp
  updated_at     timestamp

  INDEX (resource_type, resource_id)
```

### Attaching assets to a resource

In `src/routes/crud-registration.ts`:

```typescript
import { createAssetRoutes } from "@/assets";

app.route(
  "/api/categories",
  createAssetRoutes({
    resourceType: "categories",
    idParam: "id",
    permissions: {
      upload: "update-categories",
      update: "update-categories",
      remove: "update-categories",
      list: "view-categories",
    },
    tags: ["Categories"],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  }),
);
```

This generates:
- `GET /api/categories/:id/assets` - List assets
- `POST /api/categories/:id/assets` - Upload single
- `POST /api/categories/:id/assets/bulk` - Upload multiple
- `PUT /api/categories/:id/assets/:assetId` - Replace file
- `DELETE /api/categories/:id/assets/:assetId` - Delete single
- `DELETE /api/categories/:id/assets` - Delete all for resource

### Including assets in getById

To include assets when fetching a resource, add a `listByResource` call in the service's `getById`:

```typescript
import { assetService } from "@/assets";

async getById(id: string) {
  const row = await db.select().from(myTable).where(eq(myTable.id, id)).limit(1);
  if (!row[0]) return null;

  const assets = await assetService.listByResource("my-resource", row[0].id);
  return { ...row[0], assets };
}
```

### Cleaning up assets on delete

In your service's `delete` method, call `removeResourceAssets` inside the transaction:

```typescript
async delete(id: string) {
  return await db.transaction(async (tx) => {
    await assetService.removeResourceAssets("my-resource", id, tx);
    const result = await tx.delete(myTable).where(eq(myTable.id, id)).returning();
    return result.length > 0;
  });
}
```

### Uploading via curl

```sh
# Single upload
curl -X POST http://localhost:3000/api/roles/{id}/assets \
  -H "Cookie: $SESSION_COOKIE" \
  -F "file=@photo.png"

# Multiple upload
curl -X POST http://localhost:3000/api/roles/{id}/assets/bulk \
  -H "Cookie: $SESSION_COOKIE" \
  -F "files=@photo1.png" \
  -F "files=@photo2.png"

# List assets
curl http://localhost:3000/api/roles/{id}/assets \
  -H "Cookie: $SESSION_COOKIE"

# Delete single asset
curl -X DELETE http://localhost:3000/api/roles/{id}/assets/{assetId} \
  -H "Cookie: $SESSION_COOKIE"
```

### Static serving

Uploaded files are served at `/uploads/*` via Hono's static file middleware.

---

## Troubleshooting

### "relation does not exist" in tests

The test setup preload wasn't applied. Make sure you run tests via `bun run test` (which includes `--preload ./tests/setup.ts`), not bare `bun test`.

### FK constraint violations during cleanup

Delete tables in the correct order. `user.role_id` references `role.id`, so delete users before roles. See [Table cleanup order](#table-cleanup-order).

### "null value in column 'id'" on insert

The table schema is missing `.$defaultFn(() => crypto.randomUUID())` on its `id` column. Add it and regenerate migrations.

### Auth endpoints return 500

Check that migrations have been applied (`bun run db:migrate`). The `user` table needs the `role_id`, `banned`, `ban_reason`, `ban_expires`, and `two_factor_enabled` columns.

### roleId not set after sign-up

The `create.after` hook in `src/lib/auth/auth.ts` syncs `roleId` after user creation. Make sure the role table is seeded (`bun run db:seed`) and contains a row for the default role name ("user").

### Tests are flaky

Bun runs test files sequentially by default, but some test isolation issues can occur if a previous test file's `afterAll` didn't clean up properly. Each test file should fully clean and re-seed its data in `beforeAll`.
