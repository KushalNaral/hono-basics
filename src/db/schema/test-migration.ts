import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

// this is just a test migration that is done initially to test the db
// after the migration is created and then the table visibility is checked this gets removed
// the command for this is db:check
export const testMigrationTable = pgTable("test-migration", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
});
