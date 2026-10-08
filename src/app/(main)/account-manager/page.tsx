import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AccountManager from "@/components/AccountManager";
import { auth } from "@/lib/auth";
import { primaryRole } from "@/lib/roles";
import { filterUsersForTreeView } from "@/lib/user-tree";
import { listUsersForTree } from "@/lib/users";
import { getLastWorkingDayDate } from "@/lib/working-days-store";

export const metadata: Metadata = {
  title: "Account Manager · Medique Admin Manager",
};

export default async function AccountManagerPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const actorRole = primaryRole(session?.user.role);
  if (actorRole === "user") {
    redirect("/manage-bookings");
  }

  const actorId = session?.user.id ?? "";
  const users = filterUsersForTreeView(listUsersForTree(), actorId, actorRole);

  return (
    <main className="flex flex-1 px-6 py-6">
      <AccountManager
        users={users}
        actorRole={actorRole}
        actorId={actorId}
        initialLastGenerationDate={getLastWorkingDayDate()}
      />
    </main>
  );
}
