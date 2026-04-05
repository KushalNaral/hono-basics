import type { ResourceConfig } from "@/crud/types";
import {
  PermissionInsertSchema,
  PermissionSelectSchema,
  PermissionUpdateSchema,
} from "./permission.schemas";
import type { PermissionInsert, PermissionSelect } from "./permission.service";
import { permissionService } from "./permission.service";

export const permissionConfig: ResourceConfig<PermissionSelect, PermissionInsert, string> = {
  name: "permissions",
  basePath: "/api/permissions",
  idParam: "id",

  service: permissionService,

  schemas: {
    select: PermissionSelectSchema,
    insert: PermissionInsertSchema,
    update: PermissionUpdateSchema,
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
    all: "view-permissions",
    list: "view-permissions",
    getById: "view-permissions",
    create: "create-roles",
    update: "update-roles",
    delete: "delete-roles",
    bulkCreate: "create-roles",
    bulkUpdate: "update-roles",
    bulkDelete: "delete-roles",
  },

  tags: ["Permissions"],
};
