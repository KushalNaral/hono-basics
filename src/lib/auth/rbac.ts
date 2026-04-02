import { and, eq, inArray } from "drizzle-orm";
import { permission, role, rolePermission } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * RBAC Utility for programmatic permission checks.
 */
export const rbac = {
  /**
   * Get all permissions assigned to a specific role.
   */
  async getPermissionsByRole(roleName: string) {
    const result = await db
      .select({
        name: permission.name,
        group: permission.groupName,
      })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(eq(rolePermission.role, roleName));

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
      .where(and(eq(rolePermission.role, roleName), inArray(permission.name, requiredPermissions)));

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
        role: rolePermission.role,
        permissionName: permission.name,
      })
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id));

    return rolesList.map((r) => ({
      ...r,
      permissions: allMappings.filter((m) => m.role === r.name).map((m) => m.permissionName),
    }));
  },
};
