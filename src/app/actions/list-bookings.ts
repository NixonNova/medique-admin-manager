"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  DEFAULT_BOOKINGS_PAGE_SIZE,
  listBookings,
  type ListBookingsQuery,
  type ListBookingsResult,
} from "@/lib/bookings-store";

export type FetchBookingsResult =
  | { ok: true; data: ListBookingsResult }
  | { ok: false; error: string };

function failure(error: string): FetchBookingsResult {
  return { ok: false, error };
}

export async function fetchBookings(query: ListBookingsQuery = {}): Promise<FetchBookingsResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return failure("You must be signed in.");
  }

  if (
    query.bookingStart &&
    query.bookingEnd &&
    query.bookingStart > query.bookingEnd
  ) {
    return failure("Booking start date must be on or before the end date.");
  }

  const data = listBookings({
    pageSize: DEFAULT_BOOKINGS_PAGE_SIZE,
    ...query,
  });

  return { ok: true, data };
}
