import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { createEnv } from "@/lib/env";

const env = createEnv(process.env);

const db = drizzle(env.DB_URL, { schema });

export { db };
