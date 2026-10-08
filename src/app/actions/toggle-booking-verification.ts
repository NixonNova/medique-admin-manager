"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import type { BookingTableRow } from "@/lib/bookings-types";
import { NoAvailableSessionSlotError, setBookingVerified } from "@/lib/bookings-store";

export type ToggleBookingVerificationResult =
  | { ok: true; row: BookingTableRow }
  | { ok: false; error: string };

function failure(error: string): ToggleBookingVerificationResult {
  return { ok: false, error };
}

export async function toggleBookingVerification(
  bookingId: string,
  verified: boolean,
): Promise<ToggleBookingVerificationResult> {
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

  try {
    const row = setBookingVerified(id, verified, verified ? session.user.id : null);
    if (!row) {
      return failure("Booking not found.");
    }

    revalidatePath("/manage-bookings");
    return { ok: true, row };
  } catch (error) {
    if (error instanceof NoAvailableSessionSlotError) {
      return failure(error.message);
    }
    return failure("Could not update booking verification.");
  }
}
