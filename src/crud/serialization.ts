export function serializeDates<T extends Record<string, unknown>>(row: T): T {
  const result = { ...row };
  for (const [key, value] of Object.entries(result)) {
    if (value instanceof Date) {
      (result as Record<string, unknown>)[key] = value.toISOString();
    }
  }
  return result;
}

export function serializeMany<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(serializeDates);
}
