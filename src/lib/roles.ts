export const ROLES = ["medique admin", "admin", "user"] as const;

export type Role = (typeof ROLES)[number];

export const MEDIQUE_ADMIN_EMAILS = ["nixonnova@outlook.com", "admin@medique.com"] as const;

export const ROLE_LABELS: Record<Role, string> = {
  "medique admin": "Platform Admin",
  admin: "Admin",
  user: "User",
};

const RANK: Record<Role, number> = {
  "medique admin": 3,
  admin: 2,
  user: 1,
};

export function isMediqueAdminEmail(email: string) {
  return (MEDIQUE_ADMIN_EMAILS as readonly string[]).includes(email.toLowerCase());
}

/** Platform Admin and Admin choose the new user's role. */
export function setsExplicitRole(actorRole: string | null | undefined) {
  const role = primaryRole(actorRole);
  return role === "medique admin" || role === "admin";
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Highest privilege when a user has more than one role. */
export function primaryRole(role: string | null | undefined): Role | null {
  const parts = (role ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(isRole);

  if (parts.length === 0) {
    return null;
  }

  return parts.reduce((highest, part) => (RANK[part] > RANK[highest] ? part : highest));
}

/** Roles this actor is allowed to assign when creating a user. */
export function creatableRoles(actorRole: string | null | undefined): Role[] {
  switch (primaryRole(actorRole)) {
    case "medique admin":
      return ["admin", "user"];
    case "admin":
      return ["user"];
    default:
      return [];
  }
}

export function canAssignRole(actorRole: string | null | undefined, targetRole: string): boolean {
  return isRole(targetRole) && creatableRoles(actorRole).includes(targetRole);
}

/** Roles allowed when creating via "+" on a specific parent node. */
export function creatableRolesUnderParent(
  actorRole: string | null | undefined,
  parentRole: Role | null,
): Role[] {
  const allowed = creatableRoles(actorRole);
  if (!parentRole) {
    return allowed;
  }

  switch (parentRole) {
    case "medique admin":
      return allowed;
    case "admin":
      return allowed.filter((role) => role === "user");
    default:
      return [];
  }
}
