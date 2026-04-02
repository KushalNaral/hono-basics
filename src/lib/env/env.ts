import { z } from "zod";

const envSchema = z.object({
  DB_URL: z.string().url(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  POSTGRES_PORT: z.coerce.number(),
  APP_PORT: z.coerce.number(),
  APP_KEY: z.string(),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

export type Env = z.infer<typeof envSchema>;

export const createEnv = (input: NodeJS.ProcessEnv): Env => {
  return envSchema.parse(input);
};
