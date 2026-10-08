"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { primaryRole } from "@/lib/roles";
import { validateWorkingDaysForm, type WorkingDaysGenerationValues } from "@/lib/working-day-schedule";
import { saveGeneratedWorkingDays } from "@/lib/working-days-store";

export type GenerateWorkingDaysResult =
  | { ok: true; lastGenerationDate: string }
  | { ok: false; error: string };

function failure(error: string): GenerateWorkingDaysResult {
  return { ok: false, error };
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && /UNIQUE/i.test(error.message)) {
    return "Working days for that date range already exist.";
  }
  if (error instanceof Error && error.message.startsWith("Could not build")) {
    return error.message;
  }
  return "Could not generate working days.";
}

export async function generateWorkingDays(
  values: WorkingDaysGenerationValues,
): Promise<GenerateWorkingDaysResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return failure("You must be signed in.");
  }

  const actorRole = primaryRole(session.user.role);
  if (actorRole !== "medique admin" && actorRole !== "admin") {
    return failure("You cannot generate working days.");
  }

  const validationError = validateWorkingDaysForm(values);
  if (validationError) {
    return failure(validationError);
  }

  try {
    const saved = saveGeneratedWorkingDays(values);
    revalidatePath("/account-manager");
    return { ok: true, lastGenerationDate: saved.lastGenerationDate };
  } catch (error) {
    return failure(readErrorMessage(error));
  }
}
