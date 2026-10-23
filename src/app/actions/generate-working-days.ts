"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { primaryRole } from "@/lib/roles";
import { validateWorkingDaysForm, type WorkingDaysGenerationValues } from "@/lib/working-day-schedule";
import {
  checkGeneratedTimeSlots,
  saveGeneratedWorkingDays,
  WORKING_DAYS_UNAVAILABLE_MESSAGE,
} from "@/lib/working-days-store";

export type GenerateWorkingDaysResult = { ok: true } | { ok: false; error: string };

function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === WORKING_DAYS_UNAVAILABLE_MESSAGE) {
    return error.message;
  }
  if (error instanceof Error && /UNIQUE/i.test(error.message)) {
    return "Working days for that date range already exist.";
  }
  if (error instanceof Error && error.message.startsWith("Could not build")) {
    return error.message;
  }
  return "Could not generate working days.";
}

export type GenerateWorkingDaysInput = {
  values: WorkingDaysGenerationValues;
  clinicId: number;
  userId: string;
};

export type CheckWorkingDayTimeSlotsResult = { ok: true } | { ok: false; error: string };

type PreparedGeneration =
  | { ok: true; values: WorkingDaysGenerationValues; clinicId: number; userId: string }
  | { ok: false; error: string };

async function prepareGeneration(input: GenerateWorkingDaysInput): Promise<PreparedGeneration> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return failure("You must be signed in.");
  }

  const actorRole = primaryRole(session.user.role);
  if (actorRole !== "medique admin" && actorRole !== "admin" && actorRole !== "user") {
    return failure("You cannot generate working days.");
  }

  const { values, clinicId, userId } = input;
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    return failure("Select a clinic.");
  }
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return failure("Select a user.");
  }
  if (actorRole === "user" && userId.trim() !== session.user.id) {
    return failure("You cannot generate working days.");
  }

  const validationError = validateWorkingDaysForm(values);
  if (validationError) {
    return failure(validationError);
  }

  return { ok: true, values, clinicId, userId: userId.trim() };
}

export async function checkWorkingDayTimeSlots(
  input: GenerateWorkingDaysInput,
): Promise<CheckWorkingDayTimeSlotsResult> {
  const prepared = await prepareGeneration(input);
  if (!prepared.ok) {
    return prepared;
  }

  try {
    const conflict = await checkGeneratedTimeSlots(prepared.values, {
      clinicId: prepared.clinicId,
      userId: prepared.userId,
    });
    if (conflict) {
      return failure(conflict);
    }
    return { ok: true };
  } catch (error) {
    return failure(readErrorMessage(error));
  }
}

export async function generateWorkingDays(
  input: GenerateWorkingDaysInput,
): Promise<GenerateWorkingDaysResult> {
  const prepared = await prepareGeneration(input);
  if (!prepared.ok) {
    return prepared;
  }

  try {
    await saveGeneratedWorkingDays(prepared.values, {
      clinicId: prepared.clinicId,
      userId: prepared.userId,
    });
    revalidatePath("/account-manager");
    return { ok: true };
  } catch (error) {
    return failure(readErrorMessage(error));
  }
}
