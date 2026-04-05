import { eq, inArray } from "drizzle-orm";
import type { AssetSelect } from "@/assets";
import { assetService } from "@/assets";
import { createBaseService } from "@/crud/base-service";
import type { CrudService } from "@/crud/types";
import { permission, role, rolePermission } from "@/db/schema";
import { db } from "@/lib/db";

export type RoleSelect = typeof role.$inferSelect;
export type RoleInsert = typeof role.$inferInsert;
export type RoleWithPermissions = RoleSelect & { permissions: string[]; assets: AssetSelect[] };

const baseService = createBaseService<typeof role, RoleSelect, RoleInsert, string>({
  table: role,
  primaryKey: role.id,
  filterableColumns: { name: role.name },
  sortableColumns: { name: role.name, createdAt: role.createdAt },
});

async function getPermissionIdsForNames(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await db
    .select({ id: permission.id })
    .from(permission)
    .where(inArray(permission.name, names));
  return rows.map((r) => r.id);
}

async function syncPermissions(roleId: string, permissionNames: string[]): Promise<void> {
  await db.delete(rolePermission).where(eq(rolePermission.roleId, roleId));

  const permIds = await getPermissionIdsForNames(permissionNames);
  if (permIds.length > 0) {
    await db
      .insert(rolePermission)
      .values(permIds.map((permissionId) => ({ roleId, permissionId })));
  }
}

async function getPermissionsForRole(roleId: string): Promise<string[]> {
  const rows = await db
    .select({ name: permission.name })
    .from(rolePermission)
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
    .where(eq(rolePermission.roleId, roleId));
  return rows.map((r) => r.name);
}

export const roleService: CrudService<RoleSelect, RoleInsert, string, RoleWithPermissions> = {
  ...baseService,

  async getById(id: string): Promise<RoleWithPermissions | null> {
    const [row] = await db.select().from(role).where(eq(role.id, id)).limit(1);
    if (!row) return null;

    const [permissions, assets] = await Promise.all([
      getPermissionsForRole(row.id),
      assetService.listByResource("roles", row.id),
    ]);
    return { ...row, permissions, assets };
  },

  async create(data: RoleInsert & { permissions?: string[] }): Promise<RoleSelect> {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .insert(role)
        .values({
          name: data.name,
          description: data.description,
        })
        .returning();
      const newRole = rows[0];
      if (!newRole) throw new Error("Failed to insert role");

      if (data.permissions?.length) {
        const permIds = await getPermissionIdsForNames(data.permissions);
        if (permIds.length > 0) {
          await tx
            .insert(rolePermission)
            .values(permIds.map((permissionId) => ({ roleId: newRole.id, permissionId })));
        }
      }

      return newRole;
    });
  },

  async update(
    id: string,
    data: Partial<RoleInsert> & { permissions?: string[] },
  ): Promise<RoleSelect | null> {
    const existingRows = await db.select().from(role).where(eq(role.id, id)).limit(1);
    if (existingRows.length === 0) return null;

    return await db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;

      let updated = existingRows[0];
      if (!updated) return null;
      if (Object.keys(updateData).length > 0) {
        const rows = await tx.update(role).set(updateData).where(eq(role.id, id)).returning();
        updated = rows[0] ?? updated;
      }

      if (data.permissions !== undefined) {
        await syncPermissions(id, data.permissions);
      }

      return updated;
    });
  },

  async delete(id: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx.delete(rolePermission).where(eq(rolePermission.roleId, id));
      // @ts-expect-error - drizzle transaction type mismatch with NodePgDatabase
      await assetService.removeResourceAssets("roles", id, tx);
      const result = await tx.delete(role).where(eq(role.id, id)).returning();
      return result.length > 0;
    });
  },
};
