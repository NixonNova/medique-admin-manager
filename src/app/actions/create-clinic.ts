"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { insertClinic } from "@/lib/clinics";
import { primaryRole } from "@/lib/roles";

export type CreateClinicInput = {
  name: string;
  address: string;
};

export type CreateClinicResult = { ok: true } | { ok: false; error: string };

function failure(error: string): CreateClinicResult {
  return { ok: false, error };
}

async function assertCanManageClinics(): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return "You must be signed in.";
  }

  const actorRole = primaryRole(session.user.role);
  if (!actorRole || actorRole === "user") {
    return "You cannot manage clinics.";
  }

  return null;
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

export async function createClinic(input: CreateClinicInput): Promise<CreateClinicResult> {
  const denied = await assertCanManageClinics();
  if (denied) {
    return failure(denied);
  }

  const name = readClinicText(input.name, "Clinic name");
  if ("error" in name) {
    return failure(name.error);
  }
  const address = readClinicText(input.address, "Address");
  if ("error" in address) {
    return failure(address.error);
  }

  await insertClinic(name.value, address.value);
  revalidatePath("/account-manager");
  return { ok: true };
}
