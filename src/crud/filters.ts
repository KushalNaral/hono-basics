import { and, eq, ilike, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export function buildFilters(
  params: Record<string, string | number | boolean | undefined>,
  columnMap: Record<string, PgColumn>,
): SQL | undefined {
  const conditions: SQL[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;

    if (key.endsWith("_like")) {
      const actualKey = key.replace(/_like$/, "");
      const column = columnMap[actualKey];
      if (column) {
        conditions.push(ilike(column, `%${String(value)}%`));
      }
    } else {
      const column = columnMap[key];
      if (column) {
        conditions.push(eq(column, value));
      }
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}
