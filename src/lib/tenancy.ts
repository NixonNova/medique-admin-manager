import { primaryRole, type Role } from "@/lib/roles";

/** Tenant root: the billable Admin account for a business entity. */
export type OwnershipFields = {
  adminId: string | null;
  clinicId: string | null;
  /** UI / org nesting when there is no tenant adminId (e.g. under a platform admin). */
  parentUserId?: string | null;
};

export type UserForTree = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  adminId?: string | null;
  clinicId?: string | null;
  parentUserId?: string | null;
};

export type ActorForOwnership = {
  id: string;
  role?: string | null;
  adminId?: string | null;
  clinicId?: string | null;
};

const NO_OWNERSHIP: OwnershipFields = { adminId: null, clinicId: null, parentUserId: null };

export type ParentUserForOwnership = ActorForOwnership & {
  role?: string | null;
  adminId?: string | null;
};

/**
 * Ownership when the actor uses "+" on a specific tree node (optional).
 * Falls back to actor-only rules when parent is omitted.
 */
export function ownershipForNewUserUnderParent(
  actor: ActorForOwnership,
  targetRole: Role,
  parent: ParentUserForOwnership | null,
): OwnershipFields {
  if (!parent) {
    return ownershipForNewUser(actor, targetRole);
  }

  const parentRole = primaryRole(parent.role);
  const actorRole = primaryRole(actor.role);

  if (targetRole === "user") {
    if (parentRole === "admin") {
      return { adminId: parent.id, clinicId: null, parentUserId: null };
    }
    if (parentRole === "medique admin" && actorRole === "medique admin") {
      return { adminId: null, clinicId: null, parentUserId: parent.id };
    }
  }

  if (targetRole === "admin" && parentRole === "medique admin" && actorRole === "medique admin") {
    return { adminId: null, clinicId: null, parentUserId: parent.id };
  }

  return ownershipForNewUser(actor, targetRole);
}

/** Parent node id in the user tree (`null` = direct child of the Medique root). */
export function treeParentId(user: UserForTree): string | null {
  const role = primaryRole(user.role);

  if (role === "medique admin" || role === "admin") {
    if (user.parentUserId) {
      return user.parentUserId;
    }
    return null;
  }

  if (role === "user") {
    if (user.adminId) {
      return user.adminId;
    }
    if (user.parentUserId) {
      return user.parentUserId;
    }
    return null;
  }

  return user.parentUserId ?? null;
}

/** Admin account id for the tenant the actor belongs to (null for platform admins). */
export function tenantAdminId(actor: ActorForOwnership): string | null {
  const role = primaryRole(actor.role);
  if (role === "admin") {
    return actor.adminId ?? actor.id;
  }
  if (role === "user") {
    return actor.adminId ?? null;
  }
  return null;
}

/**
 * Stamp parent links when an authenticated actor creates an account.
 *
 * - Admin → User: user.adminId = admin.id
 * - Admin (tenant root): adminId set to self in user.create.after hook
 */
export function ownershipForNewUser(
  actor: ActorForOwnership,
  targetRole: Role,
): OwnershipFields {
  const actorRole = primaryRole(actor.role);

  if (targetRole === "medique admin") {
    return NO_OWNERSHIP;
  }

  if (targetRole === "admin") {
    return NO_OWNERSHIP;
  }

  if (targetRole === "user") {
    if (actorRole === "admin") {
      return { adminId: actor.id, clinicId: null };
    }
    if (actorRole === "medique admin") {
      return NO_OWNERSHIP;
    }
  }

  return NO_OWNERSHIP;
}
