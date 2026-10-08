import type { DatabaseSync } from "node:sqlite";
import type { BookingTableRow } from "@/lib/bookings-types";
import { getSqliteDatabase } from "@/lib/sqlite";
import { ensureWorkingDayTables } from "@/lib/working-days-store";

let tablesReady = false;

const SEED_ANCHOR_DATE = "2026-10-01";

const FIRST_NAMES = [
  "Alex",
  "Sam",
  "Jordan",
  "Taylor",
  "Casey",
  "Riley",
  "Morgan",
  "Jamie",
  "Avery",
  "Quinn",
  "Robin",
  "Drew",
];

const LAST_NAMES = [
  "Chen",
  "Lee",
  "Patel",
  "Nguyen",
  "Kim",
  "Wong",
  "Singh",
  "Brown",
  "Garcia",
  "Martinez",
  "Wilson",
  "Clark",
];

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

function hasTableColumn(database: DatabaseSync, table: string, column: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((entry) => entry.name === column);
}

function ensureBookingTable(database: DatabaseSync) {
  if (tablesReady) {
    return;
  }
  ensureWorkingDayTables(database);
  database.exec(`
    CREATE TABLE IF NOT EXISTS Booking (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      BookingTime TEXT NOT NULL,
      FullName TEXT NOT NULL,
      VerifiedOn TEXT
    );
  `);
  if (!hasTableColumn(database, "Booking", "SessionID")) {
    database.exec(`ALTER TABLE Booking ADD COLUMN SessionID INTEGER;`);
  }
  if (!hasTableColumn(database, "Booking", "VerifiedBy")) {
    database.exec(`ALTER TABLE Booking ADD COLUMN VerifiedBy TEXT;`);
  }
  tablesReady = true;
}

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

function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomFullName(): string {
  const first = FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)];
  const last = LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)];
  return `${first} ${last}`;
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

function findEarliestAvailableDetailId(database: DatabaseSync): number | null {
  const row = database
    .prepare(`
      SELECT d.ID AS id
      FROM WorkingDayDetail d
      INNER JOIN WorkingDayHeader h ON h.ID = d.Header
      WHERE d.BookingID IS NULL
      ORDER BY h.Date ASC, d.Start ASC, d.Slot ASC, d.ID ASC
      LIMIT 1
    `)
    .get() as { id: number } | undefined;
  return row?.id ?? null;
}

function releaseBookingSession(database: DatabaseSync, bookingId: number) {
  const booking = database
    .prepare(`SELECT SessionID AS sessionId FROM Booking WHERE ID = ?`)
    .get(bookingId) as { sessionId: number | null } | undefined;

  if (!booking?.sessionId) {
    return;
  }

  database
    .prepare(`UPDATE WorkingDayDetail SET BookingID = NULL WHERE ID = ?`)
    .run(booking.sessionId);
  database.prepare(`UPDATE Booking SET SessionID = NULL WHERE ID = ?`).run(bookingId);
}

function assignEarliestSessionToBooking(database: DatabaseSync, bookingId: number) {
  const detailId = findEarliestAvailableDetailId(database);
  if (detailId === null) {
    throw new NoAvailableSessionSlotError();
  }

  const linked = database
    .prepare(`UPDATE WorkingDayDetail SET BookingID = ? WHERE ID = ? AND BookingID IS NULL`)
    .run(bookingId, detailId);

  if (linked.changes === 0) {
    throw new NoAvailableSessionSlotError();
  }

  database.prepare(`UPDATE Booking SET SessionID = ? WHERE ID = ?`).run(detailId, bookingId);
}

function assignSessionsForSeededVerifiedBookings(database: DatabaseSync) {
  const verifiedBookings = database
    .prepare(`
      SELECT ID AS id
      FROM Booking
      WHERE VerifiedOn IS NOT NULL
      ORDER BY VerifiedOn ASC, ID ASC
    `)
    .all() as Array<{ id: number }>;

  for (const booking of verifiedBookings) {
    assignEarliestSessionToBooking(database, booking.id);
  }
}

function seedMockBookingsIfEmpty(database: DatabaseSync) {
  const countRow = database.prepare(`SELECT COUNT(*) AS count FROM Booking`).get() as {
    count: number;
  };
  if (countRow.count > 0) {
    return;
  }

  const insert = database.prepare(`
    INSERT INTO Booking (BookingTime, FullName, VerifiedOn)
    VALUES (?, ?, ?)
  `);

  database.exec("BEGIN IMMEDIATE");
  try {
    for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
      const bookingDateIso = addDays(SEED_ANCHOR_DATE, dayOffset);
      for (let i = 0; i < 2; i += 1) {
        const bookedAt = parseIsoDate(bookingDateIso);
        bookedAt.setHours(randomInt(8, 18), randomInt(0, 59), randomInt(0, 59), 0);

        const verified = Math.random() < 0.5;
        const verifiedOnIso = verified
          ? toIsoDateTime(
              (() => {
                const verifiedAt = new Date(bookedAt);
                verifiedAt.setHours(randomInt(8, 18), randomInt(0, 59), randomInt(0, 59), 0);
                if (Math.random() < 0.3) {
                  verifiedAt.setDate(verifiedAt.getDate() + 1);
                }
                return verifiedAt;
              })(),
            )
          : null;

        insert.run(toIsoDateTime(bookedAt), randomFullName(), verifiedOnIso);
      }
    }
    assignSessionsForSeededVerifiedBookings(database);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
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
  FROM Booking b
  LEFT JOIN WorkingDayDetail d ON d.ID = b.SessionID
  LEFT JOIN WorkingDayHeader h ON h.ID = d.Header
  LEFT JOIN user verifier ON verifier.id = b.VerifiedBy
`;

const bookingSelect = `
  SELECT
    b.ID AS id,
    b.BookingTime AS bookingTime,
    b.FullName AS fullName,
    b.VerifiedOn AS verifiedOn,
    h.Date AS sessionHeaderDate,
    d.Start AS sessionStart,
    d.Slot AS sessionSlot,
    verifier.name AS verifiedByName,
    verifier.email AS verifiedByEmail
  ${bookingFromJoin}
`;

function getBookingById(database: DatabaseSync, id: number): BookingTableRow | null {
  const row = database.prepare(`${bookingSelect} WHERE b.ID = ?`).get(id) as BookingDbRow | undefined;
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
  bookingTimeColumn = "BookingTime",
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

export function listBookings(query: ListBookingsQuery = {}): ListBookingsResult {
  const database = getSqliteDatabase();
  ensureBookingTable(database);
  ensureWorkingDayTables(database);
  seedMockBookingsIfEmpty(database);

  const pageSize = query.pageSize ?? DEFAULT_BOOKINGS_PAGE_SIZE;
  const page = Math.max(1, query.page ?? 1);
  const offset = (page - 1) * pageSize;
  const countWhere = buildBookingTimeWhere(query);
  const listWhere = buildBookingTimeWhere(query, "b.BookingTime");

  const countRow = database
    .prepare(`SELECT COUNT(*) AS count FROM Booking ${countWhere.clause}`)
    .get(...countWhere.params) as { count: number };

  const rows = database
    .prepare(
      `${bookingSelect} ${listWhere.clause} ORDER BY b.BookingTime DESC, b.ID DESC LIMIT ? OFFSET ?`,
    )
    .all(...listWhere.params, pageSize, offset) as BookingDbRow[];

  return {
    rows: rows.map(mapRowToListItem),
    totalCount: countRow.count,
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

export function setBookingVerified(
  id: number,
  verified: boolean,
  verifiedByUserId: string | null,
): BookingTableRow | null {
  const database = getSqliteDatabase();
  ensureBookingTable(database);
  ensureWorkingDayTables(database);

  database.exec("BEGIN IMMEDIATE");
  try {
    const booking = database
      .prepare(`SELECT ID AS id, SessionID AS sessionId FROM Booking WHERE ID = ?`)
      .get(id) as { id: number; sessionId: number | null } | undefined;

    if (!booking) {
      database.exec("ROLLBACK");
      return null;
    }

    if (verified) {
      if (!verifiedByUserId) {
        database.exec("ROLLBACK");
        throw new Error("VerifiedBy user id is required when verifying a booking.");
      }

      database
        .prepare(`UPDATE Booking SET VerifiedOn = ?, VerifiedBy = ? WHERE ID = ?`)
        .run(toIsoDateTime(new Date()), verifiedByUserId, id);

      if (booking.sessionId === null) {
        assignEarliestSessionToBooking(database, id);
      }
    } else {
      releaseBookingSession(database, id);
      database
        .prepare(`UPDATE Booking SET VerifiedOn = NULL, VerifiedBy = NULL WHERE ID = ?`)
        .run(id);
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return getBookingById(database, id);
}
