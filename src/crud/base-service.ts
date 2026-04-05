import { asc, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { buildFilters } from "./filters";
import type {
  BaseServiceConfig,
  CrudService,
  FilterParams,
  PaginationMeta,
  SortParams,
} from "./types";

function buildSortOrders(
  sort: SortParams[] | undefined,
  sortableColumns: Record<string, PgColumn> | undefined,
): SQL[] {
  if (!(sort?.length && sortableColumns)) return [];
  const orders: SQL[] = [];
  for (const s of sort) {
    const col = sortableColumns[s.field];
    if (col) {
      orders.push(s.direction === "desc" ? desc(col) : asc(col));
    }
  }
  return orders;
}

export function createBaseService<
  TTable extends PgTable,
  TSelect = TTable["$inferSelect"],
  TInsert = TTable["$inferInsert"],
  TId = string,
>(config: BaseServiceConfig<TTable>): CrudService<TSelect, TInsert, TId> {
  const { table, primaryKey, filterableColumns, sortableColumns } = config;

  const service: CrudService<TSelect, TInsert, TId> = {
    async all(filters?: FilterParams) {
      const where = filters ? buildFilters(filters, filterableColumns ?? {}) : undefined;
      const query = db.select().from(table as never);
      if (where) query.where(where);
      return (await query) as TSelect[];
    },

    async list({ filters, sort, pagination }) {
      const where = filters ? buildFilters(filters, filterableColumns ?? {}) : undefined;

      const countQuery = db.select({ value: count() }).from(table as never);
      if (where) countQuery.where(where);
      const countResult = (await countQuery) as { value: number }[];
      const totalCount = countResult[0]?.value ?? 0;

      const dataQuery = db
        .select()
        .from(table as never)
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize);

      if (where) dataQuery.where(where);

      const sortOrders = buildSortOrders(sort, sortableColumns);
      if (sortOrders.length > 0) {
        dataQuery.orderBy(...sortOrders);
      }

      const meta: PaginationMeta = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pagination.pageSize),
      };

      return { data: (await dataQuery) as TSelect[], meta };
    },

    async getById(id: TId) {
      const rows = await db
        .select()
        .from(table as never)
        .where(eq(primaryKey, id as string))
        .limit(1);
      const row = (rows as TSelect[])[0];
      return row ?? null;
    },

    async create(data: TInsert) {
      const rows = await db
        .insert(table as never)
        .values(data as never)
        .returning();
      return (rows as TSelect[])[0] as TSelect;
    },

    async update(id: TId, data: Partial<TInsert>) {
      const rows = await db
        .update(table as never)
        .set(data as never)
        .where(eq(primaryKey, id as string))
        .returning();
      return (rows as TSelect[])[0] ?? null;
    },

    async delete(id: TId) {
      const result = await db
        .delete(table as never)
        .where(eq(primaryKey, id as string))
        .returning();
      return (result as unknown[]).length > 0;
    },

    async bulkCreate(data: TInsert[]) {
      const rows = await db
        .insert(table as never)
        .values(data as never)
        .returning();
      return rows as TSelect[];
    },

    async bulkUpdate(updates) {
      return await db.transaction(async (tx) => {
        const results: TSelect[] = [];
        for (const { id, data } of updates) {
          const rows = await tx
            .update(table as never)
            .set(data as never)
            .where(eq(primaryKey, id as string))
            .returning();
          const row = (rows as TSelect[])[0];
          if (row) results.push(row);
        }
        return results;
      });
    },

    async bulkDelete(ids: TId[]) {
      const result = await db
        .delete(table as never)
        .where(inArray(primaryKey, ids as string[]))
        .returning();
      return (result as unknown[]).length;
    },
  };

  if (config.statusColumn) {
    const statusCol = config.statusColumn;
    service.changeStatus = async (ids: TId[], status: string) => {
      return await db.transaction(async (tx) => {
        const results: TSelect[] = [];
        for (const id of ids) {
          const rows = await tx
            .update(table as never)
            .set({ [statusCol.name]: status } as never)
            .where(eq(primaryKey, id as string))
            .returning();
          const row = (rows as TSelect[])[0];
          if (row) results.push(row);
        }
        return results;
      });
    };
  }

  if (config.orderColumn) {
    const orderCol = config.orderColumn;
    service.reorder = async (updates) => {
      await db.transaction(async (tx) => {
        for (const { id, order } of updates) {
          await tx
            .update(table as never)
            .set({ [orderCol.name]: order } as never)
            .where(eq(primaryKey, id as string));
        }
      });
    };
  }

  return service;
}
