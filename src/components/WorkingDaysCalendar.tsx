"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { EventCalendar, eventCalendarClasses } from "@mui/x-scheduler/event-calendar";
import type { SchedulerEvent } from "@mui/x-scheduler/models";
import type { SchedulerRenderableEventOccurrence } from "@mui/x-scheduler/models";
import { fetchWorkingDaySummaries } from "@/app/actions/list-working-day-summaries";
import WorkingDayPatientsDialog from "@/components/WorkingDayPatientsDialog";
import type { WorkingDaySlotSummary } from "@/lib/working-days-store";
import { formatIsoDate, parseIsoDate } from "@/lib/working-day-schedule";

type WorkingDaysCalendarProps = {
  initialSummaries: WorkingDaySlotSummary[];
  initialVisibleDate: string;
};

const WORKING_DAY_EVENT_PREFIX = "working-day-";

function monthIsoBounds(date: Date): { start: string; end: string; monthKey: string } {
  const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
  return {
    start: formatIsoDate(startDate),
    end: formatIsoDate(endDate),
    monthKey,
  };
}

function summariesToEvents(summaries: WorkingDaySlotSummary[]): SchedulerEvent[] {
  return summaries.map((summary) => {
    // All-day events use the same calendar day for start and end. The scheduler snaps
    // each bound to start/end of day; an exclusive next-day end becomes a 2-day span.
    const dayStart = `${summary.date}T00:00:00`;
    return {
      id: `${WORKING_DAY_EVENT_PREFIX}${summary.date}`,
      title: `${summary.verifiedBookingCount} / ${summary.totalSlotCount}`,
      start: dayStart,
      end: dayStart,
      allDay: true,
      readOnly: true,
    };
  });
}

function parseWorkingDayEventId(eventId: string | number): string | null {
  const id = String(eventId);
  if (!id.startsWith(WORKING_DAY_EVENT_PREFIX)) {
    return null;
  }
  const date = id.slice(WORKING_DAY_EVENT_PREFIX.length);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function getIsoDateFromMonthViewCell(cell: Element, visibleMonth: Date): string | null {
  const label = cell
    .querySelector(`.${eventCalendarClasses.monthViewCellNumber}`)
    ?.textContent?.trim();
  if (!label) {
    return null;
  }

  const monthDayMatch = /^([A-Za-z]{3,})\s+(\d{1,2})$/.exec(label);
  if (monthDayMatch) {
    const parsed = new Date(`${monthDayMatch[1]} ${monthDayMatch[2]}, ${visibleMonth.getFullYear()}`);
    if (!Number.isNaN(parsed.getTime())) {
      return formatIsoDate(parsed);
    }
  }

  const day = Number(label);
  if (!Number.isInteger(day)) {
    return null;
  }

  let year = visibleMonth.getFullYear();
  let month = visibleMonth.getMonth();
  if (cell.hasAttribute("data-other-month")) {
    if (day > 20) {
      month -= 1;
    } else {
      month += 1;
    }
  }

  return formatIsoDate(new Date(year, month, day));
}

export default function WorkingDaysCalendar({
  initialSummaries,
  initialVisibleDate,
}: WorkingDaysCalendarProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const initialBounds = monthIsoBounds(parseIsoDate(initialVisibleDate));
  const [summaries, setSummaries] = useState(initialSummaries);
  const [loadedMonthKey, setLoadedMonthKey] = useState(initialBounds.monthKey);
  const [visibleMonth, setVisibleMonth] = useState(() => parseIsoDate(initialVisibleDate));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [patientsOpen, setPatientsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, startLoadTransition] = useTransition();

  const events = useMemo(() => summariesToEvents(summaries), [summaries]);

  const openPatientsForDate = useCallback((date: string) => {
    setSelectedDate(date);
    setPatientsOpen(true);
  }, []);

  const loadMonth = useCallback((visibleDate: Date) => {
    const bounds = monthIsoBounds(visibleDate);
    if (bounds.monthKey === loadedMonthKey) {
      return;
    }

    startLoadTransition(async () => {
      setLoadError(null);
      const result = await fetchWorkingDaySummaries(bounds.start, bounds.end);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setSummaries(result.data);
      setLoadedMonthKey(bounds.monthKey);
    });
  }, [loadedMonthKey]);

  const handleCalendarClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const cell = (event.target as HTMLElement).closest(`.${eventCalendarClasses.monthViewCell}`);
      if (!cell || !calendarRef.current?.contains(cell)) {
        return;
      }
      const date = getIsoDateFromMonthViewCell(cell, visibleMonth);
      if (date) {
        openPatientsForDate(date);
      }
    },
    [openPatientsForDate, visibleMonth],
  );

  const handleEventEditingStart = useCallback(
    (occurrence: SchedulerRenderableEventOccurrence, eventDetails: { cancel: () => void }) => {
      const date = parseWorkingDayEventId(occurrence.id);
      if (date) {
        eventDetails.cancel();
        openPatientsForDate(date);
      }
    },
    [openPatientsForDate],
  );

  return (
    <>
      <Paper elevation={1} sx={{ overflow: "hidden", opacity: isLoading ? 0.72 : 1 }}>
        <Box sx={{ px: 2, pt: 2, pb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Each day shows verified bookings / total slots. Click a day to view patients by time slot.
          </Typography>
          {loadError ? (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
              {loadError}
            </Typography>
          ) : null}
        </Box>
        <Box ref={calendarRef} onClick={handleCalendarClick} sx={{ cursor: "pointer" }}>
          <EventCalendar
            events={events}
            views={["month"]}
            defaultView="month"
            defaultVisibleDate={parseIsoDate(initialVisibleDate)}
            onVisibleDateChange={(visibleDate) => {
              const date =
                visibleDate instanceof Date ? visibleDate : new Date(visibleDate as string | number);
              setVisibleMonth(date);
              loadMonth(date);
            }}
            onEventEditingStart={handleEventEditingStart}
            readOnly
            areEventsDraggable={false}
            areEventsResizable={false}
            preferencesMenuConfig={false}
            preferences={{ isSidePanelOpen: false }}
            sx={{
              minHeight: 640,
              border: 0,
              [`& .${eventCalendarClasses.headerToolbarSidePanelToggle}`]: { display: "none" },
              [`& .${eventCalendarClasses.sidePanelCollapse}`]: { display: "none" },
            }}
          />
        </Box>
      </Paper>

      <WorkingDayPatientsDialog
        open={patientsOpen}
        date={selectedDate}
        onClose={() => setPatientsOpen(false)}
      />
    </>
  );
}
