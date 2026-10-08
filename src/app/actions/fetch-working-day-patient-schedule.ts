"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getWorkingDayPatientSchedule,
  type WorkingDayPatientSchedule,
} from "@/lib/working-days-store";

export type FetchWorkingDayPatientScheduleResult =
  | { ok: true; data: WorkingDayPatientSchedule }
  | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function fetchWorkingDayPatientSchedule(
  date: string,
): Promise<FetchWorkingDayPatientScheduleResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return { ok: false, error: "You must be signed in." };
  }

  if (!ISO_DATE.test(date)) {
    return { ok: false, error: "Date must use YYYY-MM-DD format." };
  }

  return { ok: true, data: getWorkingDayPatientSchedule(date) };
}
