import type { DatabaseSync } from "node:sqlite";
import { getSqliteDatabase } from "@/lib/sqlite";
import {
  buildGeneratedWorkingDays,
  parseIsoDate,
  startOfToday,
  type GeneratedWorkingDay,
  type WorkingDaysGenerationValues,
} from "@/lib/working-day-schedule";

let tablesReady = false;

function hasTableColumn(database: DatabaseSync, table: string, column: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((entry) => entry.name === column);
}

export function ensureWorkingDayTables(database: DatabaseSync) {
  if (tablesReady) {
    return;
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS WorkingDayHeader (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      Date TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS WorkingDayDetail (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      Start TEXT NOT NULL,
      "End" TEXT NOT NULL,
      Slot INTEGER NOT NULL,
      Header INTEGER NOT NULL REFERENCES WorkingDayHeader(ID)
    );
  `);
  if (!hasTableColumn(database, "WorkingDayDetail", "BookingID")) {
    database.exec(`ALTER TABLE WorkingDayDetail ADD COLUMN BookingID INTEGER;`);
  }
  tablesReady = true;
}

type HeaderDateRow = {
  date: string;
};

export function getLastWorkingDayDate(): string | null {
  const database = getSqliteDatabase();
  ensureWorkingDayTables(database);
  const row = database
    .prepare(`SELECT Date AS date FROM WorkingDayHeader ORDER BY Date DESC LIMIT 1`)
    .get() as HeaderDateRow | undefined;
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
export function listWorkingDaySlotSummaries(
  dateStart: string,
  dateEnd: string,
): WorkingDaySlotSummary[] {
  const database = getSqliteDatabase();
  ensureWorkingDayTables(database);
  const rows = database
    .prepare(
      `
      SELECT
        h.Date AS date,
        COUNT(d.ID) AS totalSlotCount,
        SUM(CASE WHEN d.BookingID IS NOT NULL THEN 1 ELSE 0 END) AS verifiedBookingCount
      FROM WorkingDayHeader h
      LEFT JOIN WorkingDayDetail d ON d.Header = h.ID
      WHERE h.Date >= ? AND h.Date <= ?
      GROUP BY h.ID, h.Date
      ORDER BY h.Date ASC
      `,
    )
    .all(dateStart, dateEnd) as WorkingDaySlotSummaryRow[];

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
export function getWorkingDayPatientSchedule(date: string): WorkingDayPatientSchedule {
  const database = getSqliteDatabase();
  ensureWorkingDayTables(database);
  const rows = database
    .prepare(
      `
      SELECT
        d.Start AS start,
        d."End" AS end,
        d.Slot AS slot,
        b.FullName AS patientName
      FROM WorkingDayHeader h
      INNER JOIN WorkingDayDetail d ON d.Header = h.ID
      LEFT JOIN Booking b ON b.ID = d.BookingID
      WHERE h.Date = ?
      ORDER BY d.Start ASC, d."End" ASC, d.Slot ASC
      `,
    )
    .all(date) as WorkingDayDetailPatientRow[];

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

export function saveGeneratedWorkingDays(
  values: WorkingDaysGenerationValues,
): SaveWorkingDaysResult {
  const database = getSqliteDatabase();
  ensureWorkingDayTables(database);
  database.exec("BEGIN IMMEDIATE");
  try {
    const existing = database
      .prepare(`SELECT Date AS date FROM WorkingDayHeader ORDER BY Date DESC LIMIT 1`)
      .get() as HeaderDateRow | undefined;
    const anchor = existing ? parseIsoDate(existing.date) : startOfToday();
    const days = buildGeneratedWorkingDays(values, anchor);
    if (days.length === 0) {
      throw new Error("Could not build working days from the current values.");
    }

    const insertHeader = database.prepare(
      `INSERT INTO WorkingDayHeader (Date) VALUES (?)`,
    );
    const insertDetail = database.prepare(
      `INSERT INTO WorkingDayDetail (Start, "End", Slot, Header) VALUES (?, ?, ?, ?)`,
    );

    let slotCount = 0;
    for (const day of days) {
      const header = insertHeader.run(day.date);
      const headerId = Number(header.lastInsertRowid);
      for (const slot of day.slots) {
        insertDetail.run(slot.start, slot.end, slot.slot, headerId);
        slotCount += 1;
      }
    }

    database.exec("COMMIT");
    const lastDay: GeneratedWorkingDay = days[days.length - 1];
    return {
      lastGenerationDate: lastDay.date,
      dayCount: days.length,
      slotCount,
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
