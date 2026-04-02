import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { createEnv } from "@/lib/env";

const env = createEnv(process.env);
const db = drizzle(env.DB_URL);

async function main() {
  const result = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'test-migration'
  `);

  if (result.rows.length > 0) {
    console.log("SUCCESS: 'test-migration' table exists in the database.");
    process.exit(0);
  } else {
    console.error("FAILURE: 'test-migration' table was NOT found.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});
