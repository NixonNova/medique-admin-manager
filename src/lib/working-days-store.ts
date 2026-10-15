import { getAppDatabase } from "@/lib/app-database";
import {
  buildGeneratedWorkingDays,
  parseIsoDate,
  startOfToday,
  type GeneratedWorkingDay,
  type WorkingDaysGenerationValues,
} from "@/lib/working-day-schedule";

type HeaderDateRow = {
  date: string;
};

export async function getLastWorkingDayDate(): Promise<string | null> {
  const db = await getAppDatabase();
  const row = await db.get<HeaderDateRow>(
    `SELECT "Date" AS date FROM "WorkingDayHeader" ORDER BY "Date" DESC LIMIT 1`,
  );
  return row?.date ?? null;
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

/** Verified bookings = detail rows with a non-null BookingID; total slots = all detail rows per day. */
export async function listWorkingDaySlotSummaries(
  dateStart: string,
  dateEnd: string,
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
      WHERE h."Date" >= ? AND h."Date" <= ?
      GROUP BY h."ID", h."Date"
      ORDER BY h."Date" ASC
      `,
    [dateStart, dateEnd],
  );

  return rows.map((row) => ({
    date: row.date,
    verifiedBookingCount: Number(row.verifiedBookingCount),
    totalSlotCount: Number(row.totalSlotCount),
  }));
}

export type WorkingDayTimeSlotPatients = {
  timeLabel: string;
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
};

/** All session windows for a day; patient names only where a booking is linked on the detail row. */
export async function getWorkingDayPatientSchedule(
  date: string,
): Promise<WorkingDayPatientSchedule> {
  const db = await getAppDatabase();
  const rows = await db.all<WorkingDayDetailPatientRow>(
    `
      SELECT
        d."Start" AS start,
        d."End" AS end,
        d."Slot" AS slot,
        b."FullName" AS "patientName"
      FROM "WorkingDayHeader" h
      INNER JOIN "WorkingDayDetail" d ON d."Header" = h."ID"
      LEFT JOIN "Booking" b ON b."ID" = d."BookingID"
      WHERE h."Date" = ?
      ORDER BY d."Start" ASC, d."End" ASC, d."Slot" ASC
      `,
    [date],
  );

  const grouped = new Map<string, { timeLabel: string; patients: string[] }>();

  for (const row of rows) {
    const key = `${row.start}\0${row.end}`;
    const timeLabel = `${row.start}-${row.end}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = { timeLabel, patients: [] };
      grouped.set(key, entry);
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
  lastGenerationDate: string;
  dayCount: number;
  slotCount: number;
};

export async function saveGeneratedWorkingDays(
  values: WorkingDaysGenerationValues,
): Promise<SaveWorkingDaysResult> {
  const db = await getAppDatabase();

  return db.transaction(async (tx) => {
    const existing = await tx.get<HeaderDateRow>(
      `SELECT "Date" AS date FROM "WorkingDayHeader" ORDER BY "Date" DESC LIMIT 1`,
    );
    const anchor = existing ? parseIsoDate(existing.date) : startOfToday();
    const days = buildGeneratedWorkingDays(values, anchor);
    if (days.length === 0) {
      throw new Error("Could not build working days from the current values.");
    }

    let slotCount = 0;
    for (const day of days) {
      const inserted = await tx.get<{ id: number }>(
        `INSERT INTO "WorkingDayHeader" ("Date") VALUES (?) RETURNING "ID" AS id`,
        [day.date],
      );
      const headerId = Number(inserted?.id);

      for (const slot of day.slots) {
        await tx.run(
          `INSERT INTO "WorkingDayDetail" ("Start", "End", "Slot", "Header") VALUES (?, ?, ?, ?)`,
          [slot.start, slot.end, slot.slot, headerId],
        );
        slotCount += 1;
      }
    }

    const lastDay: GeneratedWorkingDay = days[days.length - 1];
    return {
      lastGenerationDate: lastDay.date,
      dayCount: days.length,
      slotCount,
    };
  });
}
