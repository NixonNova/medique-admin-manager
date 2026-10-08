export type WorkingWeekdayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** Monday first, for UI and stable ordering. `dayIndex` matches `Date#getDay()`. */
export const WORKING_WEEKDAYS: ReadonlyArray<{
  key: WorkingWeekdayKey;
  label: string;
  dayIndex: number;
}> = [
  { key: "monday", label: "Monday", dayIndex: 1 },
  { key: "tuesday", label: "Tuesday", dayIndex: 2 },
  { key: "wednesday", label: "Wednesday", dayIndex: 3 },
  { key: "thursday", label: "Thursday", dayIndex: 4 },
  { key: "friday", label: "Friday", dayIndex: 5 },
  { key: "saturday", label: "Saturday", dayIndex: 6 },
  { key: "sunday", label: "Sunday", dayIndex: 0 },
];

export type WorkingDaysGenerationValues = {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  workingStartTime: string;
  addBreakTime: boolean;
  breakStartTime: string;
  breakLengthMinutes: number;
  sessionsPerDay: number;
  sessionLengthMinutes: number;
  concurrentPatients: number;
  daysToGenerate: number;
};

export function isWorkingWeekday(
  date: Date,
  values: Pick<
    WorkingDaysGenerationValues,
    WorkingWeekdayKey
  >,
): boolean {
  const dayIndex = date.getDay();
  return WORKING_WEEKDAYS.some(
    (weekday) => weekday.dayIndex === dayIndex && values[weekday.key],
  );
}

export function hasAnyWorkingWeekday(
  values: Pick<WorkingDaysGenerationValues, WorkingWeekdayKey>,
): boolean {
  return WORKING_WEEKDAYS.some((weekday) => values[weekday.key]);
}

/** Calendar dates for the next `daysToGenerate` records after `lastGenerationDay`. */
export function enumerateGenerationDates(
  lastGenerationDay: Date,
  daysToGenerate: number,
  values: Pick<WorkingDaysGenerationValues, WorkingWeekdayKey>,
): Date[] {
  if (daysToGenerate <= 0 || !hasAnyWorkingWeekday(values)) {
    return [];
  }

  const dates: Date[] = [];
  let cursor = addCalendarDays(lastGenerationDay, 1);
  const maxCalendarDays = Math.max(daysToGenerate * 7, 366);

  for (let scanned = 0; scanned < maxCalendarDays && dates.length < daysToGenerate; scanned++) {
    if (isWorkingWeekday(cursor, values)) {
      dates.push(new Date(cursor));
    }
    cursor = addCalendarDays(cursor, 1);
  }

  return dates;
}

export type DailyTimetable = {
  slotCount: number;
  concurrentPatients: number;
  slotStartTimesMinutes: number[];
  lastSlotStartMinutes: number;
};

export type WorkingDaySlotRow = {
  start: string;
  end: string;
  slot: number;
};

export type GeneratedWorkingDay = {
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  slots: WorkingDaySlotRow[];
};

export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return startOfToday();
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

export function formatMinutesAsTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Slot times skip the break window [breakStart, breakStart + breakLength) when configured. */
export function computeDailyTimetable(
  workingStartMinutes: number,
  breakStartMinutes: number | null,
  breakLengthMinutes: number,
  sessionsPerDay: number,
  sessionLengthMinutes: number,
  concurrentPatients: number,
): DailyTimetable | null {
  if (sessionsPerDay <= 0 || concurrentPatients < 1 || sessionLengthMinutes <= 0) {
    return null;
  }

  const slotCount = Math.ceil(sessionsPerDay / concurrentPatients);
  const breakEnd =
    breakStartMinutes !== null ? breakStartMinutes + breakLengthMinutes : null;
  const slotStartTimesMinutes: number[] = [];
  let cursor = workingStartMinutes;

  for (let index = 0; index < slotCount; index++) {
    if (
      breakStartMinutes !== null &&
      breakEnd !== null &&
      cursor >= breakStartMinutes &&
      cursor < breakEnd
    ) {
      cursor = breakEnd;
    }
    slotStartTimesMinutes.push(cursor);
    cursor += sessionLengthMinutes;
  }

  const lastSlotStartMinutes =
    slotStartTimesMinutes[slotStartTimesMinutes.length - 1] ?? workingStartMinutes;

  return {
    slotCount,
    concurrentPatients,
    slotStartTimesMinutes,
    lastSlotStartMinutes,
  };
}

export function validateWorkingDaysForm(values: WorkingDaysGenerationValues): string | null {
  const workingStart = parseTimeToMinutes(values.workingStartTime);
  if (workingStart === null) {
    return "Enter a valid working start time (HH:MM).";
  }

  let breakStart: number | null = null;
  if (values.addBreakTime) {
    breakStart = parseTimeToMinutes(values.breakStartTime);
    if (breakStart === null) {
      return "Enter a valid break start time (HH:MM).";
    }

    if (!Number.isInteger(values.breakLengthMinutes) || values.breakLengthMinutes <= 0) {
      return "Break length must be a whole number of minutes greater than 0.";
    }
  }

  if (!Number.isInteger(values.concurrentPatients) || values.concurrentPatients < 1) {
    return "Total seats per hour must be a whole number of at least 1.";
  }

  if (!Number.isInteger(values.sessionsPerDay) || values.sessionsPerDay <= 0) {
    return "Patients per day must be a whole number greater than 0.";
  }

  if (!Number.isInteger(values.sessionLengthMinutes) || values.sessionLengthMinutes <= 0) {
    return "Session length must be a whole number of minutes greater than 0.";
  }

  if (!Number.isInteger(values.daysToGenerate) || values.daysToGenerate <= 0) {
    return "How many days to generate must be a whole number greater than 0.";
  }

  if (!hasAnyWorkingWeekday(values)) {
    return "Select at least one weekday to generate working days.";
  }

  const timetable = computeDailyTimetable(
    workingStart,
    breakStart,
    values.breakLengthMinutes,
    values.sessionsPerDay,
    values.sessionLengthMinutes,
    values.concurrentPatients,
  );

  if (!timetable) {
    return "Could not compute the daily timetable from the current values.";
  }

  if (breakStart !== null) {
    const workingEnd = timetable.lastSlotStartMinutes + values.sessionLengthMinutes;

    if (breakStart < workingStart) {
      return "Break start time must be within working hours (not before working start).";
    }

    const breakEnd = breakStart + values.breakLengthMinutes;
    if (breakEnd > workingEnd) {
      return `Break must fit within working hours (day ends around ${formatMinutesAsTime(workingEnd)}).`;
    }
  }

  return null;
}

function seatsInSlot(
  slotIndex: number,
  slotCount: number,
  sessionsPerDay: number,
  concurrentPatients: number,
): number {
  const remainder = sessionsPerDay % concurrentPatients;
  if (slotIndex === slotCount - 1 && remainder !== 0) {
    return remainder;
  }
  return concurrentPatients;
}

/** Days after `lastGenerationDay`, one header per day and one detail row per seat. */
export function buildGeneratedWorkingDays(
  values: WorkingDaysGenerationValues,
  lastGenerationDay: Date,
): GeneratedWorkingDay[] {
  const workingStart = parseTimeToMinutes(values.workingStartTime);
  if (workingStart === null) {
    return [];
  }

  const breakStart = values.addBreakTime ? parseTimeToMinutes(values.breakStartTime) : null;
  if (values.addBreakTime && breakStart === null) {
    return [];
  }

  const timetable = computeDailyTimetable(
    workingStart,
    breakStart,
    values.breakLengthMinutes,
    values.sessionsPerDay,
    values.sessionLengthMinutes,
    values.concurrentPatients,
  );
  if (!timetable) {
    return [];
  }

  const generationDates = enumerateGenerationDates(
    lastGenerationDay,
    values.daysToGenerate,
    values,
  );
  if (generationDates.length < values.daysToGenerate) {
    return [];
  }

  const days: GeneratedWorkingDay[] = [];
  for (const dayDate of generationDates) {
    const slots: WorkingDaySlotRow[] = [];
    timetable.slotStartTimesMinutes.forEach((startMinutes, index) => {
      const start = formatMinutesAsTime(startMinutes);
      const end = formatMinutesAsTime(startMinutes + values.sessionLengthMinutes);
      const seats = seatsInSlot(
        index,
        timetable.slotCount,
        values.sessionsPerDay,
        values.concurrentPatients,
      );
      for (let seat = 1; seat <= seats; seat++) {
        slots.push({ start, end, slot: seat });
      }
    });
    days.push({
      date: formatIsoDate(dayDate),
      slots,
    });
  }
  return days;
}
