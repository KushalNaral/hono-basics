import { eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { permission, role, rolePermission } from "@/db/schema";

/**
 * Permissions grouped by module/resource.
 */
const permissions = {
  users: ["list-users", "view-users", "create-users", "update-users", "delete-users", "ban-users"],
  roles: [
    "list-roles",
    "view-roles",
    "create-roles",
    "update-roles",
    "delete-roles",
    "assign-roles",
  ],
  permissions: ["view-permissions"],
  general: ["view-dashboard", "manage-settings", "update-profile", "reset-password"],
} as const;

/**
 * Role definitions with metadata.
 */
const roleDefinitions = [
  { name: "admin", description: "Full system access with all permissions." },
  { name: "moderator", description: "Can manage users and view system reports." },
  { name: "user", description: "Standard user with access to their own profile and dashboard." },
] as const;

/**
 * Role assignments (which roles get which permissions).
 */
const roleAssignments: Record<string, readonly string[] | "all"> = {
  admin: "all",
  moderator: [
    "list-users",
    "view-users",
    "view-roles",
    "view-permissions",
    "view-dashboard",
    "update-profile",
  ],
  user: ["view-dashboard", "update-profile"],
};

function allPermissionNames(): string[] {
  return Object.values(permissions).flat();
}

function generateId(): string {
  return crypto.randomUUID();
}

async function upsertRoles(db: NodePgDatabase): Promise<Map<string, string>> {
  console.log("Seeding roles...");
  const roleIdMap = new Map<string, string>();

  for (const r of roleDefinitions) {
    const existing = await db.select().from(role).where(eq(role.name, r.name));
    if (existing.length === 0) {
      const created = await db.insert(role).values(r).returning();
      const createdRole = created[0];
      if (!createdRole) throw new Error(`Failed to create role: ${r.name}`);
      roleIdMap.set(r.name, createdRole.id);
      console.log(`  + Created role: ${r.name}`);
    } else {
      await db
        .update(role)
        .set({ description: r.description, updatedAt: new Date() })
        .where(eq(role.name, r.name));
      const existingRole = existing[0];
      if (!existingRole) throw new Error(`Role disappeared: ${r.name}`);
      roleIdMap.set(r.name, existingRole.id);
    }
  }

  return roleIdMap;
}

async function upsertPermissions(db: NodePgDatabase): Promise<string[]> {
  console.log("Seeding permissions...");
  const allPermNames = allPermissionNames();

  for (const [groupName, perms] of Object.entries(permissions)) {
    for (const permName of perms) {
      const existing = await db.select().from(permission).where(eq(permission.name, permName));

      if (existing.length === 0) {
        await db.insert(permission).values({
          id: generateId(),
          name: permName,
          groupName,
        });
        console.log(`  + Created permission: ${permName} (${groupName})`);
      } else {
        await db
          .update(permission)
          .set({ groupName, updatedAt: new Date() })
          .where(eq(permission.name, permName));
      }
    }
  }

  // Clean up stale permissions
  await db.delete(permission).where(sql`${permission.name} NOT IN ${allPermNames}`);
  return allPermNames;
}

async function syncRoleAssignments(
  db: NodePgDatabase,
  allPermNames: string[],
  roleIdMap: Map<string, string>,
): Promise<void> {
  console.log("Syncing role-permission assignments...");

  for (const [roleName, assignedPerms] of Object.entries(roleAssignments)) {
    const roleId = roleIdMap.get(roleName);
    if (!roleId) continue;

    const targetPermNames = assignedPerms === "all" ? allPermNames : assignedPerms;

    // Clear existing for this role
    await db.delete(rolePermission).where(eq(rolePermission.roleId, roleId));

    // Fetch IDs for permissions
    if (targetPermNames.length > 0) {
      const permRecords = await db
        .select({ id: permission.id })
        .from(permission)
        .where(inArray(permission.name, targetPermNames as string[]));

      if (permRecords.length > 0) {
        await db.insert(rolePermission).values(
          permRecords.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        );
        console.log(`  + Role "${roleName}": ${permRecords.length} permissions assigned`);
      }
    }
  }
}

export async function seedRolePermissions(db: NodePgDatabase): Promise<void> {
  const roleIdMap = await upsertRoles(db);
  const allPermNames = await upsertPermissions(db);
  await syncRoleAssignments(db, allPermNames, roleIdMap);
  console.log("RBAC seeding complete.");
}
