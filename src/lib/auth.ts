import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { createAccessControl } from "better-auth/plugins/access";
import { admin } from "better-auth/plugins";
import { defaultStatements } from "better-auth/plugins/admin/access";
import { canAssignRole, isMediqueAdminEmail, isRole, primaryRole, type Role } from "@/lib/roles";
import { getPendingUserOwnership } from "@/lib/create-user-context";
import { getSqliteDatabase } from "@/lib/sqlite";
import { ownershipForNewUser } from "@/lib/tenancy";

const ac = createAccessControl(defaultStatements);

const adminRole = ac.newRole({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
});

const userRole = ac.newRole({
  user: [],
  session: [],
});

const roles = {
  "medique admin": adminRole,
  admin: adminRole,
  user: userRole,
} satisfies Record<Role, unknown>;

export const auth = betterAuth({
  database: getSqliteDatabase(),
  user: {
    additionalFields: {
      adminId: {
        type: "string",
        required: false,
        input: false,
      },
      clinicId: {
        type: "string",
        required: false,
        input: false,
      },
      parentUserId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  trustedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          const role = typeof user.role === "string" && user.role.length > 0 ? user.role : "user";
          const email = typeof user.email === "string" ? user.email : "";
          if (role === "medique admin" && !isMediqueAdminEmail(email)) {
            throw new APIError("FORBIDDEN", {
              message: "You cannot create a user with this role.",
            });
          }

          const session = context?.context.session;
          // Startup provisioning calls createUser with no request session.
          if (!session) {
            return;
          }

          if (!canAssignRole(session.user.role, role)) {
            throw new APIError("FORBIDDEN", {
              message: "You cannot create a user with this role.",
            });
          }

          if (!isRole(role)) {
            return;
          }

          const pending = getPendingUserOwnership();
          const ownership = pending ?? ownershipForNewUser(session.user, role);
          return {
            data: {
              ...user,
              adminId: ownership.adminId,
              clinicId: ownership.clinicId,
              parentUserId: ownership.parentUserId ?? null,
            },
          };
        },
        after: async (user, context) => {
          if (primaryRole(typeof user.role === "string" ? user.role : null) !== "admin") {
            return;
          }
          const existingAdminId = typeof user.adminId === "string" ? user.adminId : null;
          if (existingAdminId) {
            return;
          }
          const adapter = context?.context.adapter;
          if (!adapter) {
            return;
          }
          await adapter.update({
            model: "user",
            where: [{ field: "id", value: user.id }],
            update: { adminId: user.id },
          });
        },
      },
    },
  },
  plugins: [
    admin({
      ac,
      roles,
      adminRoles: ["medique admin", "admin"],
      defaultRole: "user",
    }),
    nextCookies(),
  ],
});
