import { createAccessControl } from "better-auth/plugins/access";

export const statements = {
  user: ["create", "read", "update", "delete", "list", "set-role", "ban", "impersonate"],
  session: ["list", "revoke", "delete"],
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  admin: ac.newRole({
    user: ["create", "read", "update", "delete", "list", "set-role", "ban", "impersonate"],
    session: ["list", "revoke", "delete"],
  }),
  moderator: ac.newRole({
    user: ["read", "list", "ban"],
    session: ["list", "revoke"],
  }),
  user: ac.newRole({
    user: ["read"],
    session: [],
  }),
};

export type AppRole = keyof typeof roles;
