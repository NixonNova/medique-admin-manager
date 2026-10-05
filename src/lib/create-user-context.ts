import { AsyncLocalStorage } from "node:async_hooks";
import type { OwnershipFields } from "@/lib/tenancy";

export type PendingUserOwnership = OwnershipFields & {
  parentUserId?: string | null;
};

const storage = new AsyncLocalStorage<PendingUserOwnership>();

export function runWithUserOwnership<T>(
  ownership: PendingUserOwnership,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ownership, fn);
}

export function getPendingUserOwnership(): PendingUserOwnership | undefined {
  return storage.getStore();
}
