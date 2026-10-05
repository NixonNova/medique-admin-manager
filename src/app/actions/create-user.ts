"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import {
  canAssignRole,
  creatableRolesUnderParent,
  isRole,
  primaryRole,
  setsExplicitRole,
  type Role,
} from "@/lib/roles";
import { ownershipForNewUserUnderParent } from "@/lib/tenancy";
import { canCreateUnderTreeNode } from "@/lib/user-tree";

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: string;
  parentUserId?: string | null;
};

export type CreateUserResult = { ok: true } | { ok: false; error: string };

type ParentUser = {
  id: string;
  role?: string | null;
  adminId?: string | null;
};

function failure(error: string): CreateUserResult {
  return { ok: false, error };
}

function readErrorMessage(error: unknown) {
  if (error instanceof APIError) {
    return error.message || "Could not create user.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Could not create user.";
}

function canManageParent(
  actorId: string,
  actorRole: Role,
  parent: ParentUser,
): boolean {
  const parentRole = primaryRole(parent.role);
  if (!parentRole) {
    return false;
  }

  return canCreateUnderTreeNode(actorRole, actorId, {
    id: parent.id,
    name: "",
    email: "",
    role: parent.role,
    adminId: parent.adminId ?? null,
  });
}

export async function createManagedUser(input: CreateUserInput): Promise<CreateUserResult> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session) {
    return failure("You must be signed in.");
  }

  const actorRole = primaryRole(session.user.role);
  if (!actorRole || !isRole(input.role)) {
    return failure("You cannot create a user with this role.");
  }

  const context = await auth.$context;
  let parent: ParentUser | null = null;

  if (input.parentUserId) {
    parent = await context.adapter.findOne<ParentUser>({
      model: "user",
      where: [{ field: "id", value: input.parentUserId }],
    });

    if (!parent) {
      return failure("The selected parent account no longer exists.");
    }

    if (!canManageParent(session.user.id, actorRole, parent)) {
      return failure("You cannot create an account under this node.");
    }

    const parentRole = primaryRole(parent.role);
    const allowedUnderParent = creatableRolesUnderParent(actorRole, parentRole);
    if (!allowedUnderParent.includes(input.role)) {
      return failure("You cannot create this role under the selected account.");
    }
  }

  if (!canAssignRole(actorRole, input.role)) {
    return failure("You cannot create a user with this role.");
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name) {
    return failure("Full name is required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return failure("Enter a valid email address.");
  }
  if (password.length < 8) {
    return failure("Generate a password before saving.");
  }

  const existing = await context.adapter.findOne<{ id: string }>({
    model: "user",
    where: [{ field: "email", value: email }],
  });

  if (existing) {
    return failure("A user with this email already exists.");
  }

  const ownership = ownershipForNewUserUnderParent(
    session.user,
    input.role,
    parent
      ? {
          id: parent.id,
          role: parent.role,
          adminId: parent.adminId ?? null,
        }
      : null,
  );

  try {
    const created = await auth.api.createUser({
      headers: requestHeaders,
      body: {
        name,
        email,
        password,
        ...(setsExplicitRole(actorRole) ? { role: input.role as Role } : {}),
      },
    });

    const createdUserId = created.user?.id;
    if (createdUserId) {
      await context.adapter.update({
        model: "user",
        where: [{ field: "id", value: createdUserId }],
        update: {
          adminId: ownership.adminId,
          clinicId: ownership.clinicId,
          parentUserId: ownership.parentUserId ?? null,
        },
      });
    }
  } catch (error) {
    const message = readErrorMessage(error);
    if (message.toLowerCase().includes("already exists")) {
      return failure("A user with this email already exists.");
    }
    return failure(message);
  }

  revalidatePath("/");
  return { ok: true };
}
