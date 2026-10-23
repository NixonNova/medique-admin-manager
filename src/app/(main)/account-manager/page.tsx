import type { Metadata } from "next";
import { headers } from "next/headers";
import AccountManager from "@/components/AccountManager";
import { auth } from "@/lib/auth";
import { listClinics } from "@/lib/clinics";
import { primaryRole } from "@/lib/roles";
import { filterUsersForTreeView } from "@/lib/user-tree";
import { listUserTypes } from "@/lib/user-types";
import { listUsersForTree } from "@/lib/users";

export const metadata: Metadata = {
  title: "Account Manager · Medique Admin Manager",
};

export default async function AccountManagerPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const actorRole = primaryRole(session?.user.role);
  const actorId = session?.user.id ?? "";
  const [users, userTypes, clinics] = await Promise.all([
    listUsersForTree().then((rows) => filterUsersForTreeView(rows, actorId, actorRole)),
    listUserTypes(),
    listClinics(),
  ]);

  return (
    <main className="flex flex-1 px-6 py-6">
      <AccountManager
        users={users}
        userTypes={userTypes}
        clinics={clinics}
        actorRole={actorRole}
        actorId={actorId}
      />
    </main>
  );
}
