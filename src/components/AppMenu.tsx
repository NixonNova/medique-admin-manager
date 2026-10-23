"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { authClient } from "@/lib/auth-client";

function selectedItemId(pathname: string) {
  if (pathname.startsWith("/account-manager") || pathname === "/") {
    return "account-manager";
  }
  if (pathname.startsWith("/manage-bookings")) {
    return "manage-bookings";
  }
  return null;
}

export default function AppMenu() {
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
  }

  return (
    <SimpleTreeView
      aria-label="Main menu"
      selectedItems={selectedItemId(pathname)}
      onItemClick={handleItemClick}
    >
      <TreeItem itemId="account-manager" label="Account Manager" />
      <TreeItem itemId="manage-bookings" label="Manage Bookings" />
      <TreeItem itemId="logout" label={signingOut ? "Signing out..." : "Logout"} />
    </SimpleTreeView>
  );
}
