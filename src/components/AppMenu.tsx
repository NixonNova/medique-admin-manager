"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/lib/roles";

type AppMenuProps = {
  viewerRole: Role | null;
};

function selectedItemId(pathname: string) {
  if (pathname.startsWith("/account-manager") || pathname === "/") {
    return "account-manager";
  }
  if (pathname.startsWith("/manage-bookings")) {
    return "manage-bookings";
  }
  if (pathname.startsWith("/reset-password")) {
    return "reset-password";
  }
  return null;
}

export default function AppMenu({ viewerRole }: AppMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleItemClick(event: React.MouseEvent, itemId: string) {
    if (itemId === "logout") {
      event.preventDefault();
      setSigningOut(true);
      await authClient.signOut();
      router.push("/login");
      router.refresh();
      return;
    }

    if (itemId === "account-manager") {
      router.push("/");
    }

    if (itemId === "manage-bookings") {
      router.push("/manage-bookings");
    }

    if (itemId === "reset-password") {
      router.push("/reset-password");
    }
  }

  const isUser = viewerRole === "user";

  return (
    <SimpleTreeView
      aria-label="Main menu"
      selectedItems={selectedItemId(pathname)}
      defaultExpandedItems={["configurations"]}
      onItemClick={handleItemClick}
    >
      <TreeItem itemId="configurations" label="Configurations">
        {!isUser ? <TreeItem itemId="account-manager" label="Account Manager" /> : null}
        <TreeItem itemId="manage-bookings" label="Manage Bookings" />
      </TreeItem>
      <TreeItem itemId="reset-password" label="Reset Password" />
      <TreeItem itemId="logout" label={signingOut ? "Signing out..." : "Logout"} />
    </SimpleTreeView>
  );
}
