import { createBaseService } from "@/crud/base-service";
import { permission } from "@/db/schema";

export type PermissionSelect = typeof permission.$inferSelect;
export type PermissionInsert = typeof permission.$inferInsert;

export const permissionService = createBaseService<
  typeof permission,
  PermissionSelect,
  PermissionInsert,
  string
>({
  table: permission,
  primaryKey: permission.id,
  filterableColumns: {
    name: permission.name,
    groupName: permission.groupName,
  },
  sortableColumns: {
    name: permission.name,
    groupName: permission.groupName,
    createdAt: permission.createdAt,
  },
});
