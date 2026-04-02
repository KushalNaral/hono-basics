import { defineConfig } from "drizzle-kit";
import { createEnv } from "@/lib/env";

const env = createEnv(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: env.DB_URL,
  },
  verbose: true,
  strict: true,
});
