import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const asset = pgTable(
  "asset",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("asset_resource_idx").on(table.resourceType, table.resourceId)],
);
