import type { BookingTableRow, UnverifiedStatus } from "@/lib/bookings-types";
import { type AppDatabase, getAppDatabase } from "@/lib/app-database";
import {
  formatIsoDate,
  formatMinutesAsTime,
  parseCalendarDate,
  parseTimeToMinutes,
  startOfToday,
} from "@/lib/working-day-schedule";

let ensureBookingColumnsPromise: Promise<void> | null = null;

/** Appointment date and slot the patient is booking. BookingTime stays the record timestamp. */
export function ensureBookingColumns(): Promise<void> {
  if (!ensureBookingColumnsPromise) {
    ensureBookingColumnsPromise = addBookingColumns().catch((error: unknown) => {
      ensureBookingColumnsPromise = null;
      throw error;
    });
  }
  return ensureBookingColumnsPromise;
}

async function addBookingColumns() {
  const db = await getAppDatabase();
  await db.exec(`
    ALTER TABLE "Booking"
      ADD COLUMN IF NOT EXISTS "BookingSlot" text
  `);
  await db.exec(`
    ALTER TABLE "Booking"
      ADD COLUMN IF NOT EXISTS "UnverifiedStatus" text
  `);
}

type BookingDbRow = {
  id: number;
  bookingTime: string;
  fullName: string;
  contactPhoneNumber: string | null;
  clinicName: string | null;
  practitionerName: string | null;
  practitionerEmail: string | null;
  bookingSlot: string | null;
  verifiedOn: string | null;
  sessionHeaderDate: string | null;
  sessionStart: string | null;
  sessionSlot: number | null;
  verifiedByName: string | null;
  verifiedByEmail: string | null;
  unverifiedStatus: string | null;
};

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day);
}

function parseBookingTime(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseIsoDate(value);
  }
  return parseIsoDateTime(value);
}

function toIsoDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function parseIsoDateTime(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid ISO date-time: ${value}`);
  }
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
}

function formatDateTime(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${day} ${month} ${year} ${time}`;
}

type ParsedBookingSlot = {
  date: string;
  start: string;
  end: string;
};

/** `YYYY-MM-DD HH:MM-HH:MM`, with times normalized to `HH:MM`. */
function parseBookingSlot(value: string | null): ParsedBookingSlot | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const match = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const date = parseCalendarDate(match[1]);
  const startMinutes = parseTimeToMinutes(match[2]);
  const endMinutes = parseTimeToMinutes(match[3]);
  if (!date || startMinutes === null || endMinutes === null) {
    return null;
  }

  return {
    date: formatIsoDate(date),
    start: formatMinutesAsTime(startMinutes),
    end: formatMinutesAsTime(endMinutes),
  };
}

function formatBookingSlot(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = parseBookingSlot(trimmed);
  if (!parsed) {
    return trimmed;
  }

  const date = parseIsoDate(parsed.date);
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year} ${parsed.start}-${parsed.end}`;
}

/** Unverified bookings whose selected slot date is before today. */
function isExpiredBookingSlot(value: string | null, verifiedOn: string | null): boolean {
  if (verifiedOn) {
    return false;
  }

  const parsed = parseBookingSlot(value);
  if (!parsed) {
    return false;
  }

  const slotDate = parseCalendarDate(parsed.date);
  if (!slotDate) {
    return false;
  }

  return slotDate.getTime() < startOfToday().getTime();
}

function formatSessionFromWorkingDay(isoDate: string, start: string, slot: number): string {
  const date = parseIsoDate(isoDate);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(start.trim());
  if (timeMatch) {
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
  return `${slot} · ${formatDateTime(date)}`;
}

async function findAvailableDetailIdForSlot(
  db: AppDatabase,
  slot: ParsedBookingSlot,
): Promise<number | null> {
  const row = await db.get<{ id: number }>(
    `
      SELECT d."ID" AS id
      FROM "WorkingDayDetail" d
      INNER JOIN "WorkingDayHeader" h ON h."ID" = d."Header"
      WHERE d."BookingID" IS NULL
        AND h."Date" = ?
        AND d."Start" = ?
        AND d."End" = ?
      ORDER BY d."Slot" ASC, d."ID" ASC
      LIMIT 1
    `,
    [slot.date, slot.start, slot.end],
  );
  return row?.id ?? null;
}

async function releaseBookingSession(db: AppDatabase, bookingId: number) {
  const booking = await db.get<{ sessionId: number | null }>(
    `SELECT "SessionID" AS "sessionId" FROM "Booking" WHERE "ID" = ?`,
    [bookingId],
  );

  if (!booking?.sessionId) {
    return;
  }

  await db.run(`UPDATE "WorkingDayDetail" SET "BookingID" = NULL WHERE "ID" = ?`, [
    booking.sessionId,
  ]);
  await db.run(`UPDATE "Booking" SET "SessionID" = NULL WHERE "ID" = ?`, [bookingId]);
}

async function assignSelectedSlotToBooking(
  db: AppDatabase,
  bookingId: number,
  slot: ParsedBookingSlot,
) {
  const detailId = await findAvailableDetailIdForSlot(db, slot);
  if (detailId === null) {
    throw new NoAvailableSessionSlotError();
  }

  const linked = await db.run(
    `UPDATE "WorkingDayDetail" SET "BookingID" = ? WHERE "ID" = ? AND "BookingID" IS NULL`,
    [bookingId, detailId],
  );

  if ((linked.changes ?? 0) === 0) {
    throw new NoAvailableSessionSlotError();
  }

  await db.run(`UPDATE "Booking" SET "SessionID" = ? WHERE "ID" = ?`, [detailId, bookingId]);
}

function formatVerifiedByDisplay(name: string | null, email: string | null): string | null {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName;
  }
  const trimmedEmail = email?.trim();
  return trimmedEmail || null;
}

function mapRowToListItem(row: BookingDbRow): BookingTableRow {
  const verifiedDisplay = row.verifiedOn
    ? formatDateTime(parseIsoDateTime(row.verifiedOn))
    : null;
  const sessionDisplay =
    verifiedDisplay && row.sessionHeaderDate && row.sessionStart && row.sessionSlot !== null
      ? formatSessionFromWorkingDay(row.sessionHeaderDate, row.sessionStart, row.sessionSlot)
      : null;

  return {
    id: String(row.id),
    bookedTime: formatDateTime(parseBookingTime(row.bookingTime)),
    name: row.fullName,
    contactPhoneNumber: row.contactPhoneNumber?.trim() || null,
    clinic: row.clinicName?.trim() || null,
    practitioner: formatVerifiedByDisplay(row.practitionerName, row.practitionerEmail),
    bookingSlot: formatBookingSlot(row.bookingSlot),
    expired: isExpiredBookingSlot(row.bookingSlot, row.verifiedOn),
    verifiedOn: verifiedDisplay,
    session: sessionDisplay,
    verifiedBy: verifiedDisplay
      ? formatVerifiedByDisplay(row.verifiedByName, row.verifiedByEmail)
      : null,
    unverifiedStatus: row.unverifiedStatus?.trim() || null,
  };
}

const bookingFromJoin = `
  FROM "Booking" b
  LEFT JOIN "WorkingDayDetail" d ON d."ID" = b."SessionID"
  LEFT JOIN "WorkingDayHeader" h ON h."ID" = d."Header"
  LEFT JOIN "clinic" c ON c."ID" = h."ClinicID"
  LEFT JOIN "user" practitioner ON practitioner.id = d."UserID"
  LEFT JOIN "user" verifier ON verifier.id = b."VerifiedBy"
  -- Unverified bookings have no session; still show the clinic and doctor scheduled for that slot.
  LEFT JOIN LATERAL (
    SELECT
      string_agg(DISTINCT clinic."ClinicName", ', ' ORDER BY clinic."ClinicName") AS "clinicName",
      string_agg(
        DISTINCT COALESCE(NULLIF(btrim(doctor.name), ''), NULLIF(btrim(doctor.email), '')),
        ', '
        ORDER BY COALESCE(NULLIF(btrim(doctor.name), ''), NULLIF(btrim(doctor.email), ''))
      ) AS "practitionerName"
    FROM "WorkingDayDetail" slot
    INNER JOIN "WorkingDayHeader" header ON header."ID" = slot."Header"
    LEFT JOIN "clinic" clinic ON clinic."ID" = header."ClinicID"
    LEFT JOIN "user" doctor ON doctor.id = slot."UserID"
    WHERE b."SessionID" IS NULL
      AND header."Date" = split_part(btrim(b."BookingSlot"), ' ', 1)
      AND slot."Start" = split_part(split_part(btrim(b."BookingSlot"), ' ', 2), '-', 1)
      AND slot."End" = split_part(split_part(btrim(b."BookingSlot"), ' ', 2), '-', 2)
  ) matched ON true
`;

const bookingSelect = `
  SELECT
    b."ID" AS id,
    b."BookingTime" AS "bookingTime",
    b."FullName" AS "fullName",
    b."ContactPhoneNumber" AS "contactPhoneNumber",
    COALESCE(c."ClinicName", matched."clinicName") AS "clinicName",
    COALESCE(practitioner.name, matched."practitionerName") AS "practitionerName",
    practitioner.email AS "practitionerEmail",
    b."BookingSlot" AS "bookingSlot",
    b."VerifiedOn" AS "verifiedOn",
    h."Date" AS "sessionHeaderDate",
    d."Start" AS "sessionStart",
    d."Slot" AS "sessionSlot",
    verifier.name AS "verifiedByName",
    verifier.email AS "verifiedByEmail",
    b."UnverifiedStatus" AS "unverifiedStatus"
  ${bookingFromJoin}
`;

async function getBookingById(db: AppDatabase, id: number): Promise<BookingTableRow | null> {
  const row = await db.get<BookingDbRow>(`${bookingSelect} WHERE b."ID" = ?`, [id]);
  return row ? mapRowToListItem(row) : null;
}

export const DEFAULT_BOOKINGS_PAGE_SIZE = 50;

export type ListBookingsQuery = {
  bookingStart?: string;
  bookingEnd?: string;
  page?: number;
  pageSize?: number;
};

export type ListBookingsResult = {
  rows: BookingTableRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

function buildBookingTimeWhere(
  query: ListBookingsQuery,
  bookingTimeColumn = '"BookingTime"',
): { clause: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];

  if (query.bookingStart) {
    conditions.push(`${bookingTimeColumn} >= ?`);
    params.push(`${query.bookingStart}T00:00:00`);
  }
  if (query.bookingEnd) {
    conditions.push(`${bookingTimeColumn} <= ?`);
    params.push(`${query.bookingEnd}T23:59:59`);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export async function listBookings(query: ListBookingsQuery = {}): Promise<ListBookingsResult> {
  await ensureBookingColumns();
  const db = await getAppDatabase();

  const pageSize = query.pageSize ?? DEFAULT_BOOKINGS_PAGE_SIZE;
  const page = Math.max(1, query.page ?? 1);
  const offset = (page - 1) * pageSize;
  const countWhere = buildBookingTimeWhere(query);
  const listWhere = buildBookingTimeWhere(query, 'b."BookingTime"');

  const countRow = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM "Booking" ${countWhere.clause}`,
    countWhere.params,
  );

  const rows = await db.all<BookingDbRow>(
    `${bookingSelect} ${listWhere.clause} ORDER BY b."BookingTime" DESC, b."ID" DESC LIMIT ? OFFSET ?`,
    [...listWhere.params, pageSize, offset],
  );

  return {
    rows: rows.map(mapRowToListItem),
    totalCount: Number(countRow?.count ?? 0),
    page,
    pageSize,
  };
}

export class BookingVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingVerificationError";
  }
}

export class NoAvailableSessionSlotError extends BookingVerificationError {
  constructor() {
    super("No available session slot on the selected date.");
    this.name = "NoAvailableSessionSlotError";
  }
}

export async function setBookingVerified(
  id: number,
  verified: boolean,
  verifiedByUserId: string | null,
): Promise<BookingTableRow | null> {
  await ensureBookingColumns();
  const db = await getAppDatabase();

  const result = await db.transaction(async (tx) => {
    const booking = await tx.get<{
      id: number;
      sessionId: number | null;
      bookingSlot: string | null;
    }>(
      `SELECT "ID" AS id, "SessionID" AS "sessionId", "BookingSlot" AS "bookingSlot" FROM "Booking" WHERE "ID" = ?`,
      [id],
    );

    if (!booking) {
      return null;
    }

    if (verified) {
      if (!verifiedByUserId) {
        throw new Error("VerifiedBy user id is required when verifying a booking.");
      }

      const slot = parseBookingSlot(booking.bookingSlot);
      if (!slot) {
        throw new BookingVerificationError("This booking has no selected time slot.");
      }
      if (isExpiredBookingSlot(booking.bookingSlot, null)) {
        throw new BookingVerificationError("This booking has expired.");
      }

      await tx.run(`UPDATE "Booking" SET "VerifiedOn" = ?, "VerifiedBy" = ? WHERE "ID" = ?`, [
        toIsoDateTime(new Date()),
        verifiedByUserId,
        id,
      ]);

      if (booking.sessionId === null) {
        await assignSelectedSlotToBooking(tx, id, slot);
      }
    } else {
      await releaseBookingSession(tx, id);
      await tx.run(`UPDATE "Booking" SET "VerifiedOn" = NULL, "VerifiedBy" = NULL WHERE "ID" = ?`, [
        id,
      ]);
    }

    return getBookingById(tx, id);
  });

  return result;
}

const CANCELLED_WORKING_DAY_STATUS: UnverifiedStatus = "Tidak ada praktek";

/** Unverify every verified booking linked to this clinic day and mark why. */
export async function cancelVerifiedBookingsForWorkingDay(
  date: string,
  clinicId: number,
): Promise<number> {
  await ensureBookingColumns();
  const db = await getAppDatabase();

  return db.transaction(async (tx) => {
    const rows = await tx.all<{ id: number }>(
      `
        SELECT b."ID" AS id
        FROM "WorkingDayHeader" h
        INNER JOIN "WorkingDayDetail" d ON d."Header" = h."ID"
        INNER JOIN "Booking" b ON b."ID" = d."BookingID"
        WHERE h."Date" = ?
          AND h."ClinicID" = ?
          AND b."VerifiedOn" IS NOT NULL
        ORDER BY b."ID" ASC
      `,
      [date, clinicId],
    );

    for (const row of rows) {
      await releaseBookingSession(tx, row.id);
      await tx.run(`UPDATE "WorkingDayDetail" SET "BookingID" = NULL WHERE "BookingID" = ?`, [
        row.id,
      ]);
      await tx.run(
        `UPDATE "Booking" SET "VerifiedOn" = NULL, "VerifiedBy" = NULL, "SessionID" = NULL, "UnverifiedStatus" = ? WHERE "ID" = ?`,
        [CANCELLED_WORKING_DAY_STATUS, row.id],
      );
    }

    return rows.length;
  });
}

export async function setBookingUnverifiedStatus(
  id: number,
  unverifiedStatus: UnverifiedStatus,
): Promise<BookingTableRow | null> {
  await ensureBookingColumns();
  const db = await getAppDatabase();

  const updated = await db.run(
    `UPDATE "Booking" SET "UnverifiedStatus" = ? WHERE "ID" = ?`,
    [unverifiedStatus, id],
  );
  if ((updated.changes ?? 0) === 0) {
    return null;
  }

  return getBookingById(db, id);
}
