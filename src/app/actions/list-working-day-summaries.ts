"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  listWorkingDaySlotSummaries,
  type WorkingDaySlotSummary,
} from "@/lib/working-days-store";

export type FetchWorkingDaySummariesResult =
  | { ok: true; data: WorkingDaySlotSummary[] }
  | { ok: false; error: string };

function failure(error: string): FetchWorkingDaySummariesResult {
  return { ok: false, error };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function fetchWorkingDaySummaries(
  dateStart: string,
  dateEnd: string,
  clinicId: number,
): Promise<FetchWorkingDaySummariesResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return failure("You must be signed in.");
  }

  if (!ISO_DATE.test(dateStart) || !ISO_DATE.test(dateEnd)) {
    return failure("Dates must use YYYY-MM-DD format.");
  }
  if (dateStart > dateEnd) {
    return failure("Start date must be on or before the end date.");
  }
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    return failure("Select a clinic.");
  }

  const data = await listWorkingDaySlotSummaries(dateStart, dateEnd, clinicId);
  return { ok: true, data };
}
