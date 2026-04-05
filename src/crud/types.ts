import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";

// ---- Filter / Sort / Pagination primitives ----

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface SortParams {
  field: string;
  direction: "asc" | "desc";
}

export type FilterParams = Record<string, string | number | boolean | undefined>;

// ---- CRUD operation names ----

export type CrudOperation =
  | "all"
  | "list"
  | "create"
  | "update"
  | "getById"
  | "delete"
  | "bulkCreate"
  | "bulkUpdate"
  | "bulkDelete"
  | "changeStatus"
  | "reorder";

// ---- OpenAPI route metadata ----

export interface RouteOpenApiMeta {
  summary?: string;
  description?: string;
  tags?: string[];
}

// ---- The service "interface" (Go-style) ----

export interface CrudService<TSelect, TInsert, TId = string, TSelectExpanded = TSelect> {
  all(filters?: FilterParams): Promise<TSelect[]>;

  list(params: {
    filters?: FilterParams | undefined;
    sort?: SortParams[] | undefined;
    pagination: PaginationParams;
  }): Promise<{ data: TSelect[]; meta: PaginationMeta }>;

  getById(id: TId): Promise<TSelectExpanded | null>;

  create(data: TInsert): Promise<TSelect>;

  update(id: TId, data: Partial<TInsert>): Promise<TSelect | null>;

  delete(id: TId): Promise<boolean>;

  bulkCreate(data: TInsert[]): Promise<TSelect[]>;

  bulkUpdate(updates: Array<{ id: TId; data: Partial<TInsert> }>): Promise<TSelect[]>;

  bulkDelete(ids: TId[]): Promise<number>;

  changeStatus?(ids: TId[], status: string): Promise<TSelect[]>;

  reorder?(updates: Array<{ id: TId; order: number }>): Promise<void>;
}

// ---- Base service config ----

export interface BaseServiceConfig<TTable extends PgTable> {
  table: TTable;
  primaryKey: PgColumn;
  filterableColumns?: Record<string, PgColumn>;
  sortableColumns?: Record<string, PgColumn>;
  searchColumns?: PgColumn[];
  statusColumn?: PgColumn;
  orderColumn?: PgColumn;
}

// ---- Resource config (wires service + schemas + routes) ----

export interface ResourceConfig<
  TSelect = unknown,
  TInsert = unknown,
  TId = string,
  TExpanded = TSelect,
> {
  name: string;
  basePath: string;
  idParam: string;

  service: CrudService<TSelect, TInsert, TId, TExpanded>;

  schemas: {
    select: z.ZodType;
    selectExpanded?: z.ZodType;
    insert: z.ZodType;
    update: z.ZodType;
    filters?: z.ZodType;
  };

  operations?: Partial<Record<CrudOperation, boolean>>;

  permissions?: Partial<Record<CrudOperation, string>>;

  openapi?: Partial<Record<CrudOperation, RouteOpenApiMeta>>;

  tags?: string[];

  extractId?: (raw: string) => TId;
}
