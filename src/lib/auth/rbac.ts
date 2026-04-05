import { and, eq, inArray } from "drizzle-orm";
import { permission, role, rolePermission } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * RBAC Utility for programmatic permission checks.
 */
export const rbac = {
  /**
   * Get the role ID for a given role name.
   */
  async getRoleIdByName(roleName: string): Promise<string | null> {
    const [result] = await db
      .select({ id: role.id })
      .from(role)
      .where(eq(role.name, roleName))
      .limit(1);
    return result?.id ?? null;
  },

  /**
   * Get all permissions assigned to a specific role (by name).
   */
  async getPermissionsByRole(roleName: string) {
    const result = await db
      .select({
        name: permission.name,
        group: permission.groupName,
      })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .innerJoin(role, eq(rolePermission.roleId, role.id))
      .where(eq(role.name, roleName));

    return result;
  },

  /**
   * Check if a role has all of the specified permissions.
   */
  async hasPermissions(roleName: string, requiredPermissions: string[]) {
    if (requiredPermissions.length === 0) return true;

    const result = await db
      .select({ name: permission.name })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .innerJoin(role, eq(rolePermission.roleId, role.id))
      .where(and(eq(role.name, roleName), inArray(permission.name, requiredPermissions)));

    return result.length === requiredPermissions.length;
  },

  /**
   * Get all available roles in the system.
   */
  async getAllRoles() {
    return await db.select().from(role);
  },

  /**
   * Get all defined permissions in the system.
   */
  async getAllPermissions() {
    return await db.select().from(permission);
  },

  /**
   * Get a detailed map of roles and their permissions.
   */
  async getRolesWithPermissions() {
    const rolesList = await this.getAllRoles();
    const allMappings = await db
      .select({
        roleId: rolePermission.roleId,
        permissionName: permission.name,
      })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id));

    return rolesList.map((r) => ({
      ...r,
      permissions: allMappings.filter((m) => m.roleId === r.id).map((m) => m.permissionName),
    }));
  },
};
