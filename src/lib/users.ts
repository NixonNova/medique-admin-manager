import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { UserForTree } from "@/lib/tenancy";

export type AuthUserEmail = Pick<UserForTree, "id" | "email">;

export function listUsersForTree(): UserForTree[] {
  const dbPath =
    process.env.AUTH_DATABASE_PATH ?? path.join(process.cwd(), "data", "auth.sqlite");

  if (!fs.existsSync(dbPath)) {
    return [];
  }

  const database = new DatabaseSync(dbPath, { readOnly: true });
  type Row = UserForTree;
  const rows = database
    .prepare(
      "SELECT id, name, email, role, adminId, clinicId, parentUserId FROM user ORDER BY email ASC",
    )
    .all() as Row[];
  // node:sqlite returns null-prototype row objects, which React's RSC
  // serializer rejects; map to plain objects before crossing the boundary.
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role ?? null,
    adminId: row.adminId ?? null,
    clinicId: row.clinicId ?? null,
    parentUserId: row.parentUserId ?? null,
  }));
}

/** @deprecated Use listUsersForTree */
export function listUserEmails(): AuthUserEmail[] {
  return listUsersForTree();
}
