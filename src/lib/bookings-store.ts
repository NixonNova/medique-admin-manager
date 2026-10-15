import type { BookingTableRow } from "@/lib/bookings-types";
import { type AppDatabase, getAppDatabase } from "@/lib/app-database";

type BookingDbRow = {
  id: number;
  bookingTime: string;
  fullName: string;
  verifiedOn: string | null;
  sessionHeaderDate: string | null;
  sessionStart: string | null;
  sessionSlot: number | null;
  verifiedByName: string | null;
  verifiedByEmail: string | null;
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

function formatSessionFromWorkingDay(isoDate: string, start: string, slot: number): string {
  const date = parseIsoDate(isoDate);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(start.trim());
  if (timeMatch) {
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
  return `${slot} · ${formatDateTime(date)}`;
}

async function findEarliestAvailableDetailId(db: AppDatabase): Promise<number | null> {
  const row = await db.get<{ id: number }>(
    `
      SELECT d."ID" AS id
      FROM "WorkingDayDetail" d
      INNER JOIN "WorkingDayHeader" h ON h."ID" = d."Header"
      WHERE d."BookingID" IS NULL
      ORDER BY h."Date" ASC, d."Start" ASC, d."Slot" ASC, d."ID" ASC
      LIMIT 1
    `,
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

async function assignEarliestSessionToBooking(db: AppDatabase, bookingId: number) {
  const detailId = await findEarliestAvailableDetailId(db);
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
    verifiedOn: verifiedDisplay,
    session: sessionDisplay,
    verifiedBy: verifiedDisplay
      ? formatVerifiedByDisplay(row.verifiedByName, row.verifiedByEmail)
      : null,
  };
}

const bookingFromJoin = `
  FROM "Booking" b
  LEFT JOIN "WorkingDayDetail" d ON d."ID" = b."SessionID"
  LEFT JOIN "WorkingDayHeader" h ON h."ID" = d."Header"
  LEFT JOIN "user" verifier ON verifier.id = b."VerifiedBy"
`;

const bookingSelect = `
  SELECT
    b."ID" AS id,
    b."BookingTime" AS "bookingTime",
    b."FullName" AS "fullName",
    b."VerifiedOn" AS "verifiedOn",
    h."Date" AS "sessionHeaderDate",
    d."Start" AS "sessionStart",
    d."Slot" AS "sessionSlot",
    verifier.name AS "verifiedByName",
    verifier.email AS "verifiedByEmail"
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

export class NoAvailableSessionSlotError extends Error {
  constructor() {
    super("No available session slot.");
    this.name = "NoAvailableSessionSlotError";
  }
}

export async function setBookingVerified(
  id: number,
  verified: boolean,
  verifiedByUserId: string | null,
): Promise<BookingTableRow | null> {
  const db = await getAppDatabase();

  const result = await db.transaction(async (tx) => {
    const booking = await tx.get<{ id: number; sessionId: number | null }>(
      `SELECT "ID" AS id, "SessionID" AS "sessionId" FROM "Booking" WHERE "ID" = ?`,
      [id],
    );

    if (!booking) {
      return null;
    }

    if (verified) {
      if (!verifiedByUserId) {
        throw new Error("VerifiedBy user id is required when verifying a booking.");
      }

      await tx.run(`UPDATE "Booking" SET "VerifiedOn" = ?, "VerifiedBy" = ? WHERE "ID" = ?`, [
        toIsoDateTime(new Date()),
        verifiedByUserId,
        id,
      ]);

      if (booking.sessionId === null) {
        await assignEarliestSessionToBooking(tx, id);
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
