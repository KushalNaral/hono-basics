import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { twoFactor } from "better-auth/plugins/two-factor";
import { eq } from "drizzle-orm";
import { role as roleTable, user as userTable } from "@/db/schema";
import { db } from "@/lib/db";
import { createEnv } from "@/lib/env";
import { ac, roles } from "./permissions";

const env = createEnv(process.env);

async function lookupRoleId(roleName: string): Promise<string | null> {
  const [result] = await db
    .select({ id: roleTable.id })
    .from(roleTable)
    .where(eq(roleTable.name, roleName))
    .limit(1);
  return result?.id ?? null;
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CORS_ORIGIN],
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const userData = user as Record<string, unknown>;
          const roleName = (userData.role as string | undefined) ?? "user";
          const roleId = await lookupRoleId(roleName);
          if (roleId && userData.id) {
            await db
              .update(userTable)
              .set({ roleId })
              .where(eq(userTable.id, userData.id as string));
          }
        },
      },
      update: {
        before: async (data) => {
          if (!data) return { data: data as Record<string, unknown> };
          const roleName = (data as Record<string, unknown>).role as string | undefined;
          if (roleName) {
            const roleId = await lookupRoleId(roleName);
            if (roleId) {
              return {
                data: {
                  ...(data as Record<string, unknown>),
                  roleId,
                },
              };
            }
          }
          return { data: data as Record<string, unknown> };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      ac,
      roles,
    }),
    twoFactor({
      issuer: "hono-basics",
      totpOptions: {
        digits: 6,
        period: 30,
      },
      backupCodeOptions: {
        amount: 10,
        length: 10,
      },
    }),
  ],
});

export type Auth = typeof auth;
