export { createBaseService } from "./base-service";
export { buildFilters } from "./filters";
export { createCrudRoutes } from "./route-factory";
export { serializeDates, serializeMany } from "./serialization";
export type {
  BaseServiceConfig,
  CrudOperation,
  CrudService,
  FilterParams,
  PaginationMeta,
  PaginationParams,
  ResourceConfig,
  RouteOpenApiMeta,
  SortParams,
} from "./types";
