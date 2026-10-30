"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isUnverifiedStatus, type BookingTableRow } from "@/lib/bookings-types";
import { setBookingUnverifiedStatus as saveBookingUnverifiedStatus } from "@/lib/bookings-store";

export type SetBookingUnverifiedStatusResult =
  | { ok: true; row: BookingTableRow }
  | { ok: false; error: string };

function failure(error: string): SetBookingUnverifiedStatusResult {
  return { ok: false, error };
}

export async function setBookingUnverifiedStatus(
  bookingId: string,
  unverifiedStatus: string,
): Promise<SetBookingUnverifiedStatusResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return failure("You must be signed in.");
  }

  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) {
    return failure("Invalid booking.");
  }

  if (!isUnverifiedStatus(unverifiedStatus)) {
    return failure("Invalid status.");
  }

  const row = await saveBookingUnverifiedStatus(id, unverifiedStatus);
  if (!row) {
    return failure("Booking not found.");
  }

  revalidatePath("/manage-bookings");
  return { ok: true, row };
}
