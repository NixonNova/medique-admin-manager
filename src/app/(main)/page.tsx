import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { primaryRole } from "@/lib/roles";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const actorRole = primaryRole(session?.user.role);
  if (actorRole === "user") {
    redirect("/manage-bookings");
  }

  redirect("/account-manager");
}
