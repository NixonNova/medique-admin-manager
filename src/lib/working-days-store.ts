import { getAppDatabase, type AppDatabase } from "@/lib/app-database";
import { ensureClinics } from "@/lib/clinics";
import {
  buildGeneratedWorkingDays,
  parseTimeToMinutes,
  type WorkingDaySlotRow,
  type WorkingDaysGenerationValues,
} from "@/lib/working-day-schedule";

export const WORKING_DAYS_UNAVAILABLE_MESSAGE = "Working days are not available.";

let ensureReferencesPromise: Promise<void> | null = null;

/** Clinic on each header, and the selected user on each detail row. */
export function ensureWorkingDayReferences(): Promise<void> {
  if (!ensureReferencesPromise) {
    ensureReferencesPromise = addWorkingDayReferences().catch((error: unknown) => {
      ensureReferencesPromise = null;
      throw error;
    });
  }
  return ensureReferencesPromise;
}

async function addWorkingDayReferences() {
  await ensureClinics();
  const db = await getAppDatabase();
  await db.exec(`
    ALTER TABLE "WorkingDayHeader"
      ADD COLUMN IF NOT EXISTS "ClinicID" integer REFERENCES "clinic" ("ID")
  `);
  await db.exec(`
    ALTER TABLE "WorkingDayDetail"
      ADD COLUMN IF NOT EXISTS "UserID" text REFERENCES "user" (id)
  `);
  await db.exec(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WorkingDayHeader_Date_key'
      ) THEN
        ALTER TABLE "WorkingDayHeader" DROP CONSTRAINT "WorkingDayHeader_Date_key";
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WorkingDayHeader_Date_ClinicID_key'
      ) THEN
        ALTER TABLE "WorkingDayHeader"
          ADD CONSTRAINT "WorkingDayHeader_Date_ClinicID_key" UNIQUE ("Date", "ClinicID");
      END IF;
    END $$;
  `);
}

export type WorkingDaySlotSummary = {
  date: string;
  verifiedBookingCount: number;
  totalSlotCount: number;
};

type WorkingDaySlotSummaryRow = {
  date: string;
  verifiedBookingCount: number;
  totalSlotCount: number;
};

/** Verified bookings = detail rows with a non-null BookingID; total slots = all detail rows per clinic day. */
export async function listWorkingDaySlotSummaries(
  dateStart: string,
  dateEnd: string,
  clinicId: number,
): Promise<WorkingDaySlotSummary[]> {
  const db = await getAppDatabase();
  const rows = await db.all<WorkingDaySlotSummaryRow>(
    `
      SELECT
        h."Date" AS date,
        COUNT(d."ID") AS "totalSlotCount",
        SUM(CASE WHEN d."BookingID" IS NOT NULL THEN 1 ELSE 0 END) AS "verifiedBookingCount"
      FROM "WorkingDayHeader" h
      LEFT JOIN "WorkingDayDetail" d ON d."Header" = h."ID"
      WHERE h."Date" >= ? AND h."Date" <= ? AND h."ClinicID" = ?
      GROUP BY h."ID", h."Date"
      ORDER BY h."Date" ASC
      `,
    [dateStart, dateEnd, clinicId],
  );

  return rows.map((row) => ({
    date: row.date,
    verifiedBookingCount: Number(row.verifiedBookingCount),
    totalSlotCount: Number(row.totalSlotCount),
  }));
}

export type WorkingDayTimeSlotPatients = {
  timeLabel: string;
  practitionerName: string | null;
  patients: string[];
};

export type WorkingDayPatientSchedule = {
  date: string;
  timeSlots: WorkingDayTimeSlotPatients[];
};

type WorkingDayDetailPatientRow = {
  start: string;
  end: string;
  slot: number;
  patientName: string | null;
  practitionerName: string | null;
};

/** All session windows for a clinic day; patient names only where a booking is linked on the detail row. */
export async function getWorkingDayPatientSchedule(
  date: string,
  clinicId: number,
): Promise<WorkingDayPatientSchedule> {
  const db = await getAppDatabase();
  const rows = await db.all<WorkingDayDetailPatientRow>(
    `
      SELECT
        d."Start" AS start,
        d."End" AS end,
        d."Slot" AS slot,
        b."FullName" AS "patientName",
        practitioner.name AS "practitionerName"
      FROM "WorkingDayHeader" h
      INNER JOIN "WorkingDayDetail" d ON d."Header" = h."ID"
      LEFT JOIN "Booking" b ON b."ID" = d."BookingID"
      LEFT JOIN "user" practitioner ON practitioner.id = d."UserID"
      WHERE h."Date" = ? AND h."ClinicID" = ?
      ORDER BY d."Start" ASC, d."End" ASC, d."Slot" ASC
      `,
    [date, clinicId],
  );

  const grouped = new Map<
    string,
    { timeLabel: string; practitionerName: string | null; patients: string[] }
  >();

  for (const row of rows) {
    const key = `${row.start}\0${row.end}`;
    const timeLabel = `${row.start}-${row.end}`;
    const practitionerName = row.practitionerName?.trim() || null;
    let entry = grouped.get(key);
    if (!entry) {
      entry = { timeLabel, practitionerName, patients: [] };
      grouped.set(key, entry);
    } else if (!entry.practitionerName && practitionerName) {
      entry.practitionerName = practitionerName;
    }
    if (row.patientName) {
      entry.patients.push(row.patientName);
    }
  }

  return {
    date,
    timeSlots: [...grouped.values()],
  };
}

export type SaveWorkingDaysResult = {
  dayCount: number;
  slotCount: number;
};

export type WorkingDayAssignment = {
  clinicId: number;
  userId: string;
};

type ExistingHourRow = {
  date: string;
  start: string | null;
  end: string | null;
};

type OccupiedHour = {
  start: string;
  end: string;
};

function loadDaysToGenerate(values: WorkingDaysGenerationValues) {
  const days = buildGeneratedWorkingDays(values);
  if (days.length === 0) {
    throw new Error("Could not build working days from the current values.");
  }
  return days;
}

function hoursOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const a0 = parseTimeToMinutes(startA);
  const a1 = parseTimeToMinutes(endA);
  const b0 = parseTimeToMinutes(startB);
  const b1 = parseTimeToMinutes(endB);
  if (a0 === null || a1 === null || b0 === null || b1 === null) {
    return startA === startB && endA === endB;
  }
  return a0 < b1 && b0 < a1;
}

/** True when any generated hour already has a detail row on this clinic day. */
function generatedHoursAreTaken(slots: WorkingDaySlotRow[], occupied: OccupiedHour[]): boolean {
  const seen = new Set<string>();
  for (const slot of slots) {
    const key = `${slot.start}\0${slot.end}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (occupied.some((hour) => hoursOverlap(slot.start, slot.end, hour.start, hour.end))) {
      return true;
    }
  }
  return false;
}

function occupiedHoursByDate(rows: ExistingHourRow[]): Map<string, OccupiedHour[]> {
  const byDate = new Map<string, OccupiedHour[]>();
  for (const row of rows) {
    let hours = byDate.get(row.date);
    if (!hours) {
      hours = [];
      byDate.set(row.date, hours);
    }
    if (row.start && row.end) {
      hours.push({ start: row.start, end: row.end });
    }
  }
  return byDate;
}

/**
 * A clinic day with no header is free. A header is free when every generated hour is empty,
 * so another doctor can take the remaining hours on that same day.
 * Returns the message to show, or null when every day is free.
 */
export async function findGeneratedTimeSlotConflict(
  db: AppDatabase,
  values: WorkingDaysGenerationValues,
  assignment: WorkingDayAssignment,
): Promise<string | null> {
  const days = loadDaysToGenerate(values);
  const rows = await db.all<ExistingHourRow>(
    `
      SELECT
        h."Date" AS date,
        d."Start" AS start,
        d."End" AS end
      FROM "WorkingDayHeader" h
      LEFT JOIN "WorkingDayDetail" d ON d."Header" = h."ID"
      WHERE h."ClinicID" = ?
        AND h."Date" >= ?
        AND h."Date" <= ?
    `,
    [assignment.clinicId, days[0].date, days[days.length - 1].date],
  );

  const occupiedByDate = occupiedHoursByDate(rows);
  for (const day of days) {
    const occupied = occupiedByDate.get(day.date);
    if (!occupied) {
      continue;
    }
    if (generatedHoursAreTaken(day.slots, occupied)) {
      return WORKING_DAYS_UNAVAILABLE_MESSAGE;
    }
  }
  return null;
}

/** Header for this clinic date, creating one only when that date is not already stored. */
async function ensureWorkingDayHeader(
  db: AppDatabase,
  date: string,
  clinicId: number,
): Promise<number> {
  const existing = await db.get<{ id: number }>(
    `SELECT "ID" AS id FROM "WorkingDayHeader" WHERE "Date" = ? AND "ClinicID" = ? FOR UPDATE`,
    [date, clinicId],
  );
  if (existing?.id) {
    return Number(existing.id);
  }

  const inserted = await db.get<{ id: number }>(
    `
      INSERT INTO "WorkingDayHeader" ("Date", "ClinicID")
      VALUES (?, ?)
      ON CONFLICT ("Date", "ClinicID") DO NOTHING
      RETURNING "ID" AS id
    `,
    [date, clinicId],
  );
  if (inserted?.id) {
    return Number(inserted.id);
  }

  const raced = await db.get<{ id: number }>(
    `SELECT "ID" AS id FROM "WorkingDayHeader" WHERE "Date" = ? AND "ClinicID" = ? FOR UPDATE`,
    [date, clinicId],
  );
  if (!raced?.id) {
    throw new Error("Could not save the working day.");
  }
  return Number(raced.id);
}

export async function checkGeneratedTimeSlots(
  values: WorkingDaysGenerationValues,
  assignment: WorkingDayAssignment,
): Promise<string | null> {
  await ensureWorkingDayReferences();
  const db = await getAppDatabase();
  return findGeneratedTimeSlotConflict(db, values, assignment);
}

export async function saveGeneratedWorkingDays(
  values: WorkingDaysGenerationValues,
  assignment: WorkingDayAssignment,
): Promise<SaveWorkingDaysResult> {
  await ensureWorkingDayReferences();
  const db = await getAppDatabase();

  return db.transaction(async (tx) => {
    const days = loadDaysToGenerate(values);
    let slotCount = 0;

    for (const day of days) {
      const headerId = await ensureWorkingDayHeader(tx, day.date, assignment.clinicId);
      const occupied = await tx.all<OccupiedHour>(
        `SELECT "Start" AS start, "End" AS end FROM "WorkingDayDetail" WHERE "Header" = ?`,
        [headerId],
      );
      if (generatedHoursAreTaken(day.slots, occupied)) {
        throw new Error(WORKING_DAYS_UNAVAILABLE_MESSAGE);
      }

      for (const slot of day.slots) {
        await tx.run(
          `INSERT INTO "WorkingDayDetail" ("Start", "End", "Slot", "Header", "UserID") VALUES (?, ?, ?, ?, ?)`,
          [slot.start, slot.end, slot.slot, headerId, assignment.userId],
        );
        slotCount += 1;
      }
    }

    return {
      dayCount: days.length,
      slotCount,
    };
  });
}
