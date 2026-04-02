import { createAuthClient } from "better-auth/client";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";

export function createClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [adminClient(), twoFactorClient()],
  });
}

export type AuthClient = ReturnType<typeof createClient>;
