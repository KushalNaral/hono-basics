import { drizzle } from "drizzle-orm/node-postgres";
import { createEnv } from "@/lib/env";
import { seedRolePermissions } from "./role-permission.seed";

const env = createEnv(process.env);
const db = drizzle(env.DB_URL);

async function main() {
  await seedRolePermissions(db);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
