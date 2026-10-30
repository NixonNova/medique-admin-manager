"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { cancelVerifiedBookingsForWorkingDay } from "@/lib/bookings-store";

export type CancelWorkingDayBookingsResult =
  | { ok: true; cancelledCount: number }
  | { ok: false; error: string };

function failure(error: string): CancelWorkingDayBookingsResult {
  return { ok: false, error };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function cancelWorkingDayBookings(
  date: string,
  clinicId: number,
): Promise<CancelWorkingDayBookingsResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return failure("You must be signed in.");
  }

  if (!ISO_DATE.test(date)) {
    return failure("Date must use YYYY-MM-DD format.");
  }
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    return failure("Select a clinic.");
  }

  const cancelledCount = await cancelVerifiedBookingsForWorkingDay(date, clinicId);
  revalidatePath("/manage-bookings");
  return { ok: true, cancelledCount };
}
