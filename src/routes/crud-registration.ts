import { createCrudRoutes } from "@/crud/route-factory";
import { createImageRoutes } from "@/images/image.routes";
import { permissionConfig } from "@/resources/permissions";
import { roleConfig } from "@/resources/roles";
import { app } from "../app";

export function registerCrudRoutes() {
  // Register each resource's CRUD routes
  app.route(roleConfig.basePath, createCrudRoutes(roleConfig));
  app.route(permissionConfig.basePath, createCrudRoutes(permissionConfig));

  // Image routes for roles
  const roleImageRoutes = createImageRoutes({
    resourceType: "roles",
    idParam: "id",
    permissions: {
      upload: "update-roles",
      update: "update-roles",
      remove: "update-roles",
    },
    tags: ["Roles", "Images"],
  });
  app.route("/api/roles", roleImageRoutes);
}
