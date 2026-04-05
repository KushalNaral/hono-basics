import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import type { AuthVariables } from "@/lib/auth";
import { requireAuth, requirePermission } from "@/lib/auth";
import { ErrorSchema } from "@/lib/auth/schemas";
import { serializeDates, serializeMany } from "./serialization";
import type { CrudOperation, PaginationParams, ResourceConfig, SortParams } from "./types";

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const PaginationMetaSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
  totalPages: z.number(),
});

const PAGINATION_KEYS = new Set(["page", "pageSize", "sortBy", "sortDir"]);

function parseListParams(url: URL): {
  pagination: PaginationParams;
  sort: SortParams[];
  filters: Record<string, string> | undefined;
} {
  const pagination = PaginationQuerySchema.parse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  const sortBy = url.searchParams.get("sortBy") ?? undefined;
  const sortDir = (url.searchParams.get("sortDir") as "asc" | "desc") ?? "asc";
  const sort: SortParams[] = sortBy ? [{ field: sortBy, direction: sortDir }] : [];

  const filters: Record<string, string> = {};
  for (const [k, v] of url.searchParams) {
    if (!PAGINATION_KEYS.has(k)) filters[k] = v;
  }

  return {
    pagination,
    sort,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

export function createCrudRoutes<TSelect, TInsert, TId = string, TExpanded = TSelect>(
  config: ResourceConfig<TSelect, TInsert, TId, TExpanded>,
): Hono<{ Variables: AuthVariables }> {
  const router = new Hono<{ Variables: AuthVariables }>();
  const { service, schemas, permissions, openapi, tags } = config;

  const ops = {
    all: true,
    list: true,
    create: true,
    update: true,
    getById: true,
    delete: true,
    bulkCreate: true,
    bulkUpdate: true,
    bulkDelete: true,
    changeStatus: false,
    reorder: false,
    ...config.operations,
  };

  const extractId = config.extractId ?? ((raw: string) => raw as unknown as TId);

  function middlewareFor(op: CrudOperation) {
    const mw = [requireAuth];
    const perm = permissions?.[op];
    if (perm) mw.push(requirePermission(perm));
    return mw;
  }

  function meta(op: CrudOperation, defaults: { summary: string; description?: string }) {
    const overrides = openapi?.[op];
    const result: Record<string, unknown> = {
      summary: overrides?.summary ?? defaults.summary,
    };
    const desc = overrides?.description ?? defaults.description;
    if (desc) result.description = desc;
    const t = overrides?.tags ?? tags;
    if (t) result.tags = t;
    return result;
  }

  // ---- GET /all ----
  if (ops.all) {
    router.get(
      "/all",
      describeRoute({
        ...meta("all", { summary: `Get all ${config.name}` }),
        responses: {
          200: {
            description: `List of all ${config.name}`,
            content: {
              "application/json": {
                schema: resolver(z.object({ data: z.array(schemas.select) })),
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("all"),
      async (c) => {
        const url = new URL(c.req.url);
        const filters: Record<string, string> = {};
        for (const [k, v] of url.searchParams) {
          filters[k] = v;
        }
        const data = await service.all(Object.keys(filters).length > 0 ? filters : undefined);
        return c.json({ data: serializeMany(data as Record<string, unknown>[]) }, 200);
      },
    );
  }

  // ---- GET / (list with pagination) ----
  if (ops.list) {
    router.get(
      "/",
      describeRoute({
        ...meta("list", { summary: `List ${config.name} with pagination` }),
        responses: {
          200: {
            description: `Paginated list of ${config.name}`,
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    data: z.array(schemas.select),
                    meta: PaginationMetaSchema,
                  }),
                ),
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("list"),
      async (c) => {
        const { pagination, sort, filters } = parseListParams(new URL(c.req.url));
        const result = await service.list({ filters, sort, pagination });

        return c.json(
          {
            data: serializeMany(result.data as Record<string, unknown>[]),
            meta: result.meta,
          },
          200,
        );
      },
    );
  }

  // ---- POST /bulk (before /:id) ----
  if (ops.bulkCreate) {
    router.post(
      "/bulk",
      describeRoute({
        ...meta("bulkCreate", { summary: `Bulk create ${config.name}` }),
        responses: {
          201: {
            description: `Created multiple ${config.name}`,
            content: {
              "application/json": {
                schema: resolver(z.object({ data: z.array(schemas.select) })),
              },
            },
          },
          400: {
            description: "Validation error",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("bulkCreate"),
      async (c) => {
        const body = await c.req.json();
        const parsed = z.array(schemas.insert).safeParse(body);
        if (!parsed.success) {
          return c.json({ error: "Validation Error", message: parsed.error.message }, 400);
        }
        const data = await service.bulkCreate(parsed.data as TInsert[]);
        return c.json({ data: serializeMany(data as Record<string, unknown>[]) }, 201);
      },
    );
  }

  // ---- PUT /bulk ----
  if (ops.bulkUpdate) {
    router.put(
      "/bulk",
      describeRoute({
        ...meta("bulkUpdate", { summary: `Bulk update ${config.name}` }),
        responses: {
          200: {
            description: `Updated multiple ${config.name}`,
            content: {
              "application/json": {
                schema: resolver(z.object({ data: z.array(schemas.select) })),
              },
            },
          },
          400: {
            description: "Validation error",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("bulkUpdate"),
      async (c) => {
        const body = await c.req.json();
        const itemSchema = z.object({ id: z.string(), data: schemas.update });
        const parsed = z.array(itemSchema).safeParse(body);
        if (!parsed.success) {
          return c.json({ error: "Validation Error", message: parsed.error.message }, 400);
        }
        const data = await service.bulkUpdate(
          parsed.data.map((item) => ({
            id: extractId(item.id),
            data: item.data as Partial<TInsert>,
          })),
        );
        return c.json({ data: serializeMany(data as Record<string, unknown>[]) }, 200);
      },
    );
  }

  // ---- DELETE /bulk ----
  if (ops.bulkDelete) {
    router.delete(
      "/bulk",
      describeRoute({
        ...meta("bulkDelete", { summary: `Bulk delete ${config.name}` }),
        responses: {
          200: {
            description: "Deleted count",
            content: {
              "application/json": {
                schema: resolver(z.object({ deletedCount: z.number() })),
              },
            },
          },
          400: {
            description: "Validation error",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("bulkDelete"),
      async (c) => {
        const body = await c.req.json();
        const parsed = z.object({ ids: z.array(z.string()) }).safeParse(body);
        if (!parsed.success) {
          return c.json({ error: "Validation Error", message: parsed.error.message }, 400);
        }
        const deletedCount = await service.bulkDelete(parsed.data.ids.map(extractId));
        return c.json({ deletedCount }, 200);
      },
    );
  }

  // ---- PUT /reorder ----
  if (ops.reorder && service.reorder) {
    router.put(
      "/reorder",
      describeRoute({
        ...meta("reorder", { summary: `Reorder ${config.name}` }),
        responses: {
          200: {
            description: "Reordered successfully",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
              },
            },
          },
          400: {
            description: "Validation error",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("reorder"),
      async (c) => {
        const body = await c.req.json();
        const parsed = z.array(z.object({ id: z.string(), order: z.number() })).safeParse(body);
        if (!parsed.success) {
          return c.json({ error: "Validation Error", message: parsed.error.message }, 400);
        }
        await service.reorder?.(
          parsed.data.map((item) => ({ id: extractId(item.id), order: item.order })),
        );
        return c.json({ success: true }, 200);
      },
    );
  }

  // ---- PATCH /status ----
  if (ops.changeStatus && service.changeStatus) {
    router.patch(
      "/status",
      describeRoute({
        ...meta("changeStatus", { summary: `Change ${config.name} status` }),
        responses: {
          200: {
            description: "Status updated",
            content: {
              "application/json": {
                schema: resolver(z.object({ data: z.array(schemas.select) })),
              },
            },
          },
          400: {
            description: "Validation error",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("changeStatus"),
      async (c) => {
        const body = await c.req.json();
        const parsed = z.object({ ids: z.array(z.string()), status: z.string() }).safeParse(body);
        if (!parsed.success) {
          return c.json({ error: "Validation Error", message: parsed.error.message }, 400);
        }
        const data = await service.changeStatus?.(
          parsed.data.ids.map(extractId),
          parsed.data.status,
        );
        return c.json({ data: serializeMany(data as Record<string, unknown>[]) }, 200);
      },
    );
  }

  // ---- POST / (create) ----
  if (ops.create) {
    router.post(
      "/",
      describeRoute({
        ...meta("create", { summary: `Create ${config.name}` }),
        responses: {
          201: {
            description: `Created ${config.name}`,
            content: {
              "application/json": {
                schema: resolver(z.object({ data: schemas.select })),
              },
            },
          },
          400: {
            description: "Validation error",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("create"),
      async (c) => {
        const body = await c.req.json();
        const parsed = schemas.insert.safeParse(body);
        if (!parsed.success) {
          return c.json({ error: "Validation Error", message: parsed.error.message }, 400);
        }
        const data = await service.create(parsed.data as TInsert);
        return c.json({ data: serializeDates(data as Record<string, unknown>) }, 201);
      },
    );
  }

  // ---- GET /:id ----
  if (ops.getById) {
    router.get(
      `/:${config.idParam}`,
      describeRoute({
        ...meta("getById", { summary: `Get ${config.name} by ID` }),
        responses: {
          200: {
            description: `Single ${config.name} record`,
            content: {
              "application/json": {
                schema: resolver(z.object({ data: schemas.selectExpanded ?? schemas.select })),
              },
            },
          },
          404: {
            description: "Not found",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("getById"),
      async (c) => {
        const id = extractId(c.req.param(config.idParam) ?? "");
        const data = await service.getById(id);
        if (!data) return c.json({ error: "Not Found", message: `${config.name} not found` }, 404);
        return c.json({ data: serializeDates(data as Record<string, unknown>) }, 200);
      },
    );
  }

  // ---- PUT /:id ----
  if (ops.update) {
    router.put(
      `/:${config.idParam}`,
      describeRoute({
        ...meta("update", { summary: `Update ${config.name}` }),
        responses: {
          200: {
            description: `Updated ${config.name}`,
            content: {
              "application/json": {
                schema: resolver(z.object({ data: schemas.select })),
              },
            },
          },
          400: {
            description: "Validation error",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
          404: {
            description: "Not found",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("update"),
      async (c) => {
        const id = extractId(c.req.param(config.idParam) ?? "");
        const body = await c.req.json();
        const parsed = schemas.update.safeParse(body);
        if (!parsed.success) {
          return c.json({ error: "Validation Error", message: parsed.error.message }, 400);
        }
        const data = await service.update(id, parsed.data as Partial<TInsert>);
        if (!data) return c.json({ error: "Not Found", message: `${config.name} not found` }, 404);
        return c.json({ data: serializeDates(data as Record<string, unknown>) }, 200);
      },
    );
  }

  // ---- DELETE /:id ----
  if (ops.delete) {
    router.delete(
      `/:${config.idParam}`,
      describeRoute({
        ...meta("delete", { summary: `Delete ${config.name}` }),
        responses: {
          200: {
            description: "Deleted successfully",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
              },
            },
          },
          404: {
            description: "Not found",
            content: { "application/json": { schema: resolver(ErrorSchema) } },
          },
        },
        security: [{ cookieAuth: [] }],
      }),
      ...middlewareFor("delete"),
      async (c) => {
        const id = extractId(c.req.param(config.idParam) ?? "");
        const deleted = await service.delete(id);
        if (!deleted)
          return c.json({ error: "Not Found", message: `${config.name} not found` }, 404);
        return c.json({ success: true }, 200);
      },
    );
  }

  return router;
}
