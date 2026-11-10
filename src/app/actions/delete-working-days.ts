"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { primaryRole } from "@/lib/roles";
import { deleteWorkingDaysForClinic } from "@/lib/working-days-store";

export type DeleteWorkingDaysResult =
  | { ok: true; deletedCount: number }
  | { ok: false; error: string };

export type DeleteWorkingDaysInput = {
  clinicId: number;
  startDate: string;
  endDate: string;
};

function failure(error: string): DeleteWorkingDaysResult {
  return { ok: false, error };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function deleteWorkingDays(
  input: DeleteWorkingDaysInput,
): Promise<DeleteWorkingDaysResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return failure("You must be signed in.");
  }

  const actorRole = primaryRole(session.user.role);
  if (actorRole !== "medique admin" && actorRole !== "admin" && actorRole !== "user") {
    return failure("You cannot delete working days.");
  }

  const { clinicId, startDate, endDate } = input;
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    return failure("Select a clinic.");
  }
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    return failure("Dates must use YYYY-MM-DD format.");
  }
  if (startDate > endDate) {
    return failure("Start date must be on or before the end date.");
  }

  try {
    const deletedCount = await deleteWorkingDaysForClinic(startDate, endDate, clinicId);
    revalidatePath("/account-manager");
    revalidatePath("/manage-bookings");
    return { ok: true, deletedCount };
  } catch {
    return failure("Could not delete working days.");
  }
}
