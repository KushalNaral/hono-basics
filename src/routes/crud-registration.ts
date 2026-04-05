import { createAssetRoutes } from "@/assets";
import { createCrudRoutes } from "@/crud/route-factory";
import { permissionConfig } from "@/resources/permissions";
import { roleConfig } from "@/resources/roles";
import { app } from "../app";

export function registerCrudRoutes() {
  // Register each resource's CRUD routes
  app.route(roleConfig.basePath, createCrudRoutes(roleConfig));
  app.route(permissionConfig.basePath, createCrudRoutes(permissionConfig));

  // Asset routes for roles
  app.route(
    "/api/roles",
    createAssetRoutes({
      resourceType: "roles",
      idParam: "id",
      permissions: {
        upload: "update-roles",
        update: "update-roles",
        remove: "update-roles",
        list: "view-roles",
      },
      tags: ["Roles", "Assets"],
    }),
  );
}
