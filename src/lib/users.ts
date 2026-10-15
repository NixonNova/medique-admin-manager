import { getAppDatabase } from "@/lib/app-database";
import type { UserForTree } from "@/lib/tenancy";
import { ensureUserTypes } from "@/lib/user-types";

export type AuthUserEmail = Pick<UserForTree, "id" | "email">;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  adminId: string | null;
  clinicId: string | null;
  parentUserId: string | null;
  userTypeLabel: string | null;
  userTypeIds: string | null;
};

export async function listUsersForTree(): Promise<UserForTree[]> {
  await ensureUserTypes();
  const db = await getAppDatabase();
  const rows = await db.all<UserRow>(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u."adminId",
      u."clinicId",
      u."parentUserId",
      types.names AS "userTypeLabel",
      types.ids AS "userTypeIds"
    FROM "user" u
    LEFT JOIN (
      SELECT
        link."UserID",
        string_agg(t."Name", ', ' ORDER BY t."ID") AS names,
        string_agg(t."ID"::text, ',' ORDER BY t."ID") AS ids
      FROM "userusertype" link
      INNER JOIN "usertype" t ON t."ID" = link."UserTypeID"
      GROUP BY link."UserID"
    ) types ON types."UserID" = u.id
    ORDER BY u.email ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role ?? null,
    adminId: row.adminId ?? null,
    clinicId: row.clinicId ?? null,
    parentUserId: row.parentUserId ?? null,
    userTypeLabel: row.userTypeLabel ?? "",
    userTypeIds: (row.userTypeIds ?? "")
      .split(",")
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  }));
}

/** @deprecated Use listUsersForTree */
export async function listUserEmails(): Promise<AuthUserEmail[]> {
  return listUsersForTree();
}
