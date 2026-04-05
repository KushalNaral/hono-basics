# Hono Basics

A production-ready REST API built with [Hono](https://hono.dev/), [Better Auth](https://www.better-auth.com/), and [Drizzle ORM](https://orm.drizzle.team/) on the [Bun](https://bun.sh/) runtime. Features a generic CRUD factory, role-based access control (RBAC), image uploads, two-factor authentication, and auto-generated OpenAPI documentation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Framework | Hono |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Auth | Better Auth (email/password, admin plugin, 2FA) |
| Validation | Zod + zod-openapi |
| API Docs | hono-openapi + Swagger UI |
| Linting | Biome |
| Testing | Bun test runner |
| Containers | Docker / Docker Compose |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose (for the database)

### 1. Clone and install

```sh
git clone <repo-url> && cd hono-basics
bun install
```

### 2. Configure environment

```sh
cp .env.example .env
```

Edit `.env` if you need to change ports, secrets, or database credentials. The defaults work out of the box with the Docker Compose setup.

### 3. Start the database

```sh
docker compose up db -d --wait
```

### 4. Run migrations and seed

```sh
bun run db:migrate
bun run db:seed
```

### 5. Start the dev server

```sh
bun run dev
```

The API is now running at **http://localhost:3000**.

- Swagger UI: http://localhost:3000/doc
- OpenAPI spec: http://localhost:3000/openapi.json

### Alternative: Full Docker setup

```sh
# Development (hot-reload)
bun run dev:docker

# Production
bun run prod:docker
```

## Project Structure

```
src/
  index.ts                      # Entry point - middleware, routes, docs
  app.ts                        # Hono app instance
  crud/                         # Generic CRUD factory
    base-service.ts             #   Base service (filter, sort, paginate)
    route-factory.ts            #   Route generator with OpenAPI
    types.ts                    #   CrudService, ResourceConfig types
    filters.ts                  #   Query filter builder
    serialization.ts            #   Date serialization helpers
  db/
    schema/                     # Drizzle table definitions
      auth-schema.ts            #   user, session, account, verification, twoFactor
      rbac-schema.ts            #   role, permission, rolePermission
    seed/
      role-permission.seed.ts   #   Seeds 3 roles + 17 permissions
    migrate.ts                  #   Migration runner
  images/                       # Image upload system
    image.routes.ts             #   Upload, update, delete (single + bulk)
    image.service.ts            #   File system operations
    image.schemas.ts            #   Zod response schemas
  lib/
    auth/
      auth.ts                   #   Better Auth config (plugins, hooks)
      middleware.ts             #   sessionMiddleware, requireAuth, requirePermission
      permissions.ts            #   Access control statements + role definitions
      rbac.ts                   #   RBAC utility functions
      schemas.ts                #   Shared Zod schemas
    db/
      db.ts                     #   Drizzle instance
    env/
      env.ts                    #   Zod-validated env config
  resources/                    # Resource configurations
    roles/
      role.config.ts            #   ResourceConfig for roles
      role.service.ts           #   Role service (with permission expansion)
      role.schemas.ts           #   Zod schemas for roles
    permissions/
      permission.config.ts      #   ResourceConfig for permissions
      permission.service.ts     #   Permission service
      permission.schemas.ts     #   Zod schemas for permissions
  routes/
    main-routes.ts              #   GET /, GET /me
    auth-docs.ts                #   OpenAPI docs for Better Auth endpoints
    crud-registration.ts        #   Registers CRUD + image routes
    rbac-routes.ts              #   GET /api/rbac/me/permissions

tests/
  setup.ts                      # Drops schema, runs migrations before tests
  auth/                         # Auth, RBAC, role-sync tests
  crud/                         # CRUD operation tests
  images/                       # Image upload tests
  db/                           # Migration tests
  env/                          # Environment validation tests

drizzle/                        # SQL migration files
uploads/                        # Uploaded images (gitignored in production)
```

## API Endpoints

### Authentication (Better Auth)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/sign-up/email` | Register a new user | - |
| POST | `/api/auth/sign-in/email` | Log in | - |
| POST | `/api/auth/sign-out` | Log out | Cookie |
| GET | `/api/auth/session` | Get current session | Cookie |
| GET | `/api/auth/admin/list-users` | List all users | Admin |
| POST | `/api/auth/admin/set-role` | Change a user's role | Admin |

### Roles CRUD

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/roles/all` | List all roles | `list-roles` |
| GET | `/api/roles` | Paginated list (supports sort/filter) | `list-roles` |
| GET | `/api/roles/:id` | Get role with permissions expanded | `view-roles` |
| POST | `/api/roles` | Create role (with permissions) | `create-roles` |
| PUT | `/api/roles/:id` | Update role | `update-roles` |
| DELETE | `/api/roles/:id` | Delete role | `delete-roles` |
| POST | `/api/roles/bulk` | Bulk create | `create-roles` |
| PUT | `/api/roles/bulk` | Bulk update | `update-roles` |
| DELETE | `/api/roles/bulk` | Bulk delete | `delete-roles` |

### Permissions CRUD

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/permissions/all` | List all permissions | `view-permissions` |
| GET | `/api/permissions` | Paginated list | `view-permissions` |
| GET | `/api/permissions/:id` | Get single permission | `view-permissions` |
| POST | `/api/permissions` | Create permission | `create-roles` |
| PUT | `/api/permissions/:id` | Update permission | `update-roles` |
| DELETE | `/api/permissions/:id` | Delete permission | `delete-roles` |

### Role Images

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/roles/:id/images` | Upload single image | `update-roles` |
| POST | `/api/roles/:id/images/bulk` | Upload multiple images | `update-roles` |
| PUT | `/api/roles/:id/images/:filename` | Replace an image | `update-roles` |
| DELETE | `/api/roles/:id/images/:filename` | Delete an image | `update-roles` |
| DELETE | `/api/roles/:id/images` | Delete all images for a role | `update-roles` |

### RBAC

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/rbac/me/permissions` | Get current user's role and permissions | Cookie |

### Utility

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | Welcome message | - |
| GET | `/me` | Current user profile + session | Cookie |
| GET | `/doc` | Swagger UI | - |
| GET | `/openapi.json` | OpenAPI spec | - |

### Query Parameters

Paginated endpoints (`GET /api/{resource}`) support:

| Param | Example | Description |
|-------|---------|-------------|
| `page` | `1` | Page number (default: 1) |
| `pageSize` | `20` | Items per page (default: 20, max: 100) |
| `sortBy` | `name` | Column to sort by (must be in `sortableColumns`) |
| `sortDir` | `asc` or `desc` | Sort direction (default: asc) |
| `{column}` | `groupName=users` | Exact match filter |
| `{column}_like` | `name_like=view` | Case-insensitive partial match |

## RBAC Model

### Default Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **admin** | Full system access | All 17 permissions |
| **moderator** | Can manage users and view system data | list-users, view-users, view-roles, view-permissions, view-dashboard, update-profile |
| **user** | Standard user | view-dashboard, update-profile |

### Permission Groups

| Group | Permissions |
|-------|------------|
| users | list-users, view-users, create-users, update-users, delete-users, ban-users |
| roles | list-roles, view-roles, create-roles, update-roles, delete-roles, assign-roles |
| permissions | view-permissions |
| general | view-dashboard, manage-settings, update-profile, reset-password |

New users are assigned the `user` role automatically on sign-up. The `roleId` foreign key is synced via a Better Auth database hook.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_URL` | PostgreSQL connection string | `postgresql://postgres:postgres123@localhost:5433/hono_db` |
| `POSTGRES_USER` | DB username | `postgres` |
| `POSTGRES_PASSWORD` | DB password | `postgres123` |
| `POSTGRES_DB` | Database name | `hono_db` |
| `POSTGRES_PORT` | DB host port | `5433` |
| `APP_PORT` | Application port | `3000` |
| `APP_KEY` | Application secret key | - |
| `NODE_ENV` | Environment | `development` |
| `BETTER_AUTH_SECRET` | Auth signing secret | - |
| `BETTER_AUTH_URL` | Auth base URL | `http://localhost:3000` |
| `LOG_LEVEL` | Logging level | `info` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start dev server with hot reload |
| `bun run dev:docker` | Start dev environment in Docker |
| `bun run prod:docker` | Start production in Docker |
| `bun run build` | Build to `dist/` |
| `bun run test` | Run all tests |
| `bun run test:docker` | Spin up test DB + run tests |
| `bun run check` | TypeScript + Biome lint |
| `bun run typecheck` | TypeScript type check only |
| `bun run lint` | Biome lint |
| `bun run lint:fix` | Biome lint with auto-fix |
| `bun run format` | Biome format |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:push` | Push schema directly to DB |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Seed RBAC data |

## License

MIT
