"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { updateClinic } from "@/lib/clinics";
import { primaryRole } from "@/lib/roles";

export type UpdateClinicInput = {
  id: number;
  name: string;
  address: string;
};

export type UpdateClinicResult = { ok: true } | { ok: false; error: string };

function failure(error: string): UpdateClinicResult {
  return { ok: false, error };
}

function readClinicText(value: unknown, label: string): { value: string } | { error: string } {
  if (typeof value !== "string") {
    return { error: `${label} is required.` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: `${label} is required.` };
  }
  return { value: trimmed };
}

export async function updateManagedClinic(input: UpdateClinicInput): Promise<UpdateClinicResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return failure("You must be signed in.");
  }

  const actorRole = primaryRole(session.user.role);
  if (!actorRole || actorRole === "user") {
    return failure("You cannot manage clinics.");
  }

  const id = typeof input.id === "number" ? input.id : Number.NaN;
  if (!Number.isInteger(id) || id < 1) {
    return failure("You cannot edit this clinic.");
  }

  const name = readClinicText(input.name, "Clinic name");
  if ("error" in name) {
    return failure(name.error);
  }
  const address = readClinicText(input.address, "Address");
  if ("error" in address) {
    return failure(address.error);
  }

  const updated = await updateClinic(id, name.value, address.value);
  if (!updated) {
    return failure("This clinic no longer exists.");
  }

  revalidatePath("/account-manager");
  return { ok: true };
}
