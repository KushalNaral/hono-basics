import type { ResourceConfig } from "@/crud/types";
import {
  RoleExpandedSchema,
  RoleInsertSchema,
  RoleSelectSchema,
  RoleUpdateSchema,
} from "./role.schemas";
import type { RoleInsert, RoleSelect, RoleWithPermissions } from "./role.service";
import { roleService } from "./role.service";

export const roleConfig: ResourceConfig<RoleSelect, RoleInsert, string, RoleWithPermissions> = {
  name: "roles",
  basePath: "/api/roles",
  idParam: "id",

  service: roleService,

  schemas: {
    select: RoleSelectSchema,
    selectExpanded: RoleExpandedSchema,
    insert: RoleInsertSchema,
    update: RoleUpdateSchema,
  },

  operations: {
    all: true,
    list: true,
    create: true,
    update: true,
    getById: true,
    delete: true,
    bulkCreate: true,
    bulkUpdate: true,
    bulkDelete: true,
    changeStatus: false,
    reorder: false,
  },

  permissions: {
    all: "view-roles",
    list: "list-roles",
    getById: "view-roles",
    create: "create-roles",
    update: "update-roles",
    delete: "delete-roles",
    bulkCreate: "create-roles",
    bulkUpdate: "update-roles",
    bulkDelete: "delete-roles",
  },

  tags: ["Roles"],
};
