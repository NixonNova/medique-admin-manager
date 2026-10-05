import type { TreeViewDefaultItemModelProperties } from "@mui/x-tree-view/models";
import { primaryRole, type Role } from "@/lib/roles";
import { treeParentId, type UserForTree } from "@/lib/tenancy";

export const USER_TREE_ROOT_ID = "users";

function compareByEmail(a: UserForTree, b: UserForTree) {
  return a.email.localeCompare(b.email);
}

function buildNode(user: UserForTree, byParent: Map<string, UserForTree[]>): TreeViewDefaultItemModelProperties {
  const childUsers = byParent.get(user.id) ?? [];
  const children = childUsers.sort(compareByEmail).map((child) => buildNode(child, byParent));

  return {
    id: user.id,
    label: user.email,
    ...(children.length > 0 ? { children } : {}),
  };
}

export function collectTreeItemIds(
  items: TreeViewDefaultItemModelProperties[],
): string[] {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(item.id);
    if (item.children?.length) {
      ids.push(...collectTreeItemIds(item.children));
    }
  }
  return ids;
}

function buildChildrenByParent(users: UserForTree[]): Map<string, string[]> {
  const byParent = new Map<string, string[]>();

  for (const user of users) {
    const parentId = treeParentId(user) ?? USER_TREE_ROOT_ID;
    const bucket = byParent.get(parentId);
    if (bucket) {
      bucket.push(user.id);
    } else {
      byParent.set(parentId, [user.id]);
    }
  }

  return byParent;
}

function collectDescendantIds(rootId: string, childrenByParent: Map<string, string[]>): Set<string> {
  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];

  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || descendants.has(id)) {
      continue;
    }
    descendants.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }

  return descendants;
}

function collectAncestorIds(
  userId: string,
  usersById: Map<string, UserForTree>,
): Set<string> {
  const ancestors = new Set<string>();
  let parentId = treeParentId(usersById.get(userId) ?? { id: userId, name: "", email: "" });

  while (parentId) {
    if (!usersById.has(parentId)) {
      break;
    }
    ancestors.add(parentId);
    parentId = treeParentId(usersById.get(parentId)!);
  }

  return ancestors;
}

/** Limits tree data by signed-in role (full tree for platform admins). */
export function filterUsersForTreeView(
  users: UserForTree[],
  actorId: string,
  actorRole: Role | null,
): UserForTree[] {
  if (!actorRole || actorRole === "medique admin") {
    return users;
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const actor = usersById.get(actorId);
  if (!actor) {
    return [];
  }

  const visible = new Set<string>([actorId]);
  const childrenByParent = buildChildrenByParent(users);

  if (actorRole === "admin") {
    for (const ancestorId of collectAncestorIds(actorId, usersById)) {
      visible.add(ancestorId);
    }
    for (const descendantId of collectDescendantIds(actorId, childrenByParent)) {
      visible.add(descendantId);
    }
  }

  if (actorRole === "user") {
    if (actor.adminId && usersById.has(actor.adminId)) {
      visible.add(actor.adminId);
    } else {
      for (const ancestorId of collectAncestorIds(actorId, usersById)) {
        visible.add(ancestorId);
      }
    }
  }

  return users.filter((user) => visible.has(user.id));
}

export function buildUserTreeItems(users: UserForTree[]): TreeViewDefaultItemModelProperties[] {
  const byParent = new Map<string, UserForTree[]>();

  for (const user of users) {
    const parentId = treeParentId(user) ?? USER_TREE_ROOT_ID;
    const bucket = byParent.get(parentId);
    if (bucket) {
      bucket.push(user);
    } else {
      byParent.set(parentId, [user]);
    }
  }

  const roots = (byParent.get(USER_TREE_ROOT_ID) ?? []).sort(compareByEmail);
  const rootChildren = roots.map((user) => buildNode(user, byParent));

  return [
    {
      id: USER_TREE_ROOT_ID,
      label: "Medique",
      children:
        rootChildren.length > 0 ? rootChildren : [{ id: "users-empty", label: "No users found" }],
    },
  ];
}

/** Whether the actor may use "+" on this tree node. */
export function canCreateUnderTreeNode(
  actorRole: Role | null,
  actorId: string,
  nodeUser: UserForTree | null,
): boolean {
  if (!actorRole) {
    return false;
  }

  if (!nodeUser) {
    return false;
  }

  const nodeRole = primaryRole(nodeUser.role);
  if (!nodeRole) {
    return false;
  }

  if (actorRole === "medique admin") {
    return nodeRole === "medique admin" || nodeRole === "admin";
  }

  if (actorRole === "admin") {
    return nodeUser.id === actorId;
  }

  return false;
}
