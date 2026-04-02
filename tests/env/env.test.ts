import { describe, expect, it } from "bun:test";
import { createEnv } from "@/lib/env";

describe("Env validation", () => {
  it("parses valid env", () => {
    const env = createEnv({
      DB_URL: "http://localhost:5432",
      POSTGRES_USER: "postgres",
      POSTGRES_PASSWORD: "secret",
      POSTGRES_DB: "app",
      POSTGRES_PORT: "5432",
      APP_PORT: "3000",
      APP_KEY: "abc",
      NODE_ENV: "test",
      BETTER_AUTH_SECRET: "test-secret-key",
      BETTER_AUTH_URL: "http://localhost:3000",
      LOG_LEVEL: "info",
      CORS_ORIGIN: "http://localhost:3000",
    });

    expect(env.DB_URL).toBe("http://localhost:5432");
    expect(env.POSTGRES_USER).toBe("postgres");
    expect(env.POSTGRES_PASSWORD).toBe("secret");
    expect(env.POSTGRES_DB).toBe("app");
    expect(env.POSTGRES_PORT).toBe(5432);
    expect(env.APP_PORT).toBe(3000);
    expect(env.APP_KEY).toBe("abc");
    expect(env.APP_PORT).toBe(3000);
  });

  it("throws on invalid env", () => {
    expect(() => {
      createEnv({
        DB_URL: "not-url-here-for-zod-safe-parse",
      });
    }).toThrow();
  });
});
