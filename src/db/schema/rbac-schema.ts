import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const role = pgTable("role", {
  name: text("name").primaryKey(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const permission = pgTable(
  "permission",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    groupName: text("group_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("permission_group_name_idx").on(table.groupName)],
);

export const rolePermission = pgTable(
  "role_permission",
  {
    role: text("role")
      .notNull()
      .references(() => role.name, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permission.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.role, table.permissionId] }),
    index("role_permission_role_idx").on(table.role),
  ],
);

export const roleRelations = relations(role, ({ many }) => ({
  rolePermissions: many(rolePermission),
}));

export const permissionRelations = relations(permission, ({ many }) => ({
  rolePermissions: many(rolePermission),
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role: one(role, {
    fields: [rolePermission.role],
    references: [role.name],
  }),
  permission: one(permission, {
    fields: [rolePermission.permissionId],
    references: [permission.id],
  }),
}));
