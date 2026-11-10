"use client";

import { useEffect, useState } from "react";

type ClinicOption = {
  id: number;
};

export function firstClinicId(clinics: ClinicOption[]): string {
  return clinics.length > 0 ? String(clinics[0].id) : "";
}

/** Selects the first clinic when the list has items and the current value is missing. */
export function useDefaultClinicId(clinics: ClinicOption[]) {
  const [clinicId, setClinicId] = useState(() => firstClinicId(clinics));

  useEffect(() => {
    setClinicId((current) => {
      if (current && clinics.some((clinic) => String(clinic.id) === current)) {
        return current;
      }
      return firstClinicId(clinics);
    });
  }, [clinics]);

  return [clinicId, setClinicId] as const;
}
