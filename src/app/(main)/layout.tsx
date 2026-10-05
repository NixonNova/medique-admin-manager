import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppMenu from "@/components/AppMenu";
import { auth } from "@/lib/auth";
import { primaryRole } from "@/lib/roles";

export default async function MainLayout({ children }: LayoutProps<"/">) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const viewerRole = primaryRole(session.user.role);

  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-700">
            Medique Admin Manager
          </p>
          <p className="mt-2 text-sm text-slate-700">{session.user.email}</p>
        </div>
        <nav className="flex-1 px-2 py-3">
          <AppMenu viewerRole={viewerRole} />
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
