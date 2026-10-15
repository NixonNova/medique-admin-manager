"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { primaryRole } from "@/lib/roles";
import { filterUsersForTreeView } from "@/lib/user-tree";
import { listUsersForTree } from "@/lib/users";
import {
  normalizeUserTypeIds,
  replaceUserTypeAssignments,
  userTypeSelectionError,
} from "@/lib/user-types";

export type UpdateUserTypesInput = {
  userId: string;
  userTypeIds?: number[];
};

export type UpdateUserTypesResult = { ok: true } | { ok: false; error: string };

function failure(error: string): UpdateUserTypesResult {
  return { ok: false, error };
}

export async function updateManagedUserTypes(
  input: UpdateUserTypesInput,
): Promise<UpdateUserTypesResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return failure("You must be signed in.");
  }

  const actorRole = primaryRole(session.user.role);
  if (!actorRole || actorRole === "user") {
    return failure("You cannot edit this user.");
  }

  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  if (!userId) {
    return failure("You cannot edit this user.");
  }

  const userTypeIds = normalizeUserTypeIds(input.userTypeIds);
  if (!userTypeIds) {
    return failure("Select a valid user type.");
  }

  const userTypeError = await userTypeSelectionError(userTypeIds);
  if (userTypeError) {
    return failure(userTypeError);
  }

  const visibleUsers = filterUsersForTreeView(
    await listUsersForTree(),
    session.user.id,
    actorRole,
  );
  const target = visibleUsers.find((user) => user.id === userId);
  if (!target || primaryRole(target.role) !== "user") {
    return failure("You cannot edit this user.");
  }

  await replaceUserTypeAssignments(userId, userTypeIds);
  revalidatePath("/");
  revalidatePath("/account-manager");
  return { ok: true };
}
