"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { EventCalendar, eventCalendarClasses } from "@mui/x-scheduler/event-calendar";
import type { SchedulerEvent } from "@mui/x-scheduler/models";
import type { SchedulerRenderableEventOccurrence } from "@mui/x-scheduler/models";
import { fetchWorkingDaySummaries } from "@/app/actions/list-working-day-summaries";
import WorkingDayPatientsDialog from "@/components/WorkingDayPatientsDialog";
import type { Clinic } from "@/lib/clinics";
import type { WorkingDaySlotSummary } from "@/lib/working-days-store";
import { formatIsoDate, parseIsoDate } from "@/lib/working-day-schedule";

type WorkingDaysCalendarProps = {
  clinics: Clinic[];
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
  clinics,
  initialVisibleDate,
}: WorkingDaysCalendarProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const [clinicId, setClinicId] = useState("");
  const [summaries, setSummaries] = useState<WorkingDaySlotSummary[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => parseIsoDate(initialVisibleDate));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [patientsOpen, setPatientsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, startLoadTransition] = useTransition();

  const events = useMemo(() => summariesToEvents(summaries), [summaries]);
  const selectedClinicId = clinicId ? Number(clinicId) : null;

  const openPatientsForDate = useCallback((date: string) => {
    setSelectedDate(date);
    setPatientsOpen(true);
  }, []);

  const loadSummaries = useCallback((visibleDate: Date, selectedClinic: string) => {
    if (!selectedClinic) {
      loadedKeyRef.current = null;
      setSummaries([]);
      setLoadError(null);
      return;
    }

    const bounds = monthIsoBounds(visibleDate);
    const nextKey = `${selectedClinic}:${bounds.monthKey}`;
    if (loadedKeyRef.current === nextKey) {
      return;
    }
    loadedKeyRef.current = nextKey;

    startLoadTransition(async () => {
      setLoadError(null);
      const result = await fetchWorkingDaySummaries(bounds.start, bounds.end, Number(selectedClinic));
      if (loadedKeyRef.current !== nextKey) {
        return;
      }
      if (!result.ok) {
        loadedKeyRef.current = null;
        setSummaries([]);
        setLoadError(result.error);
        return;
      }
      setSummaries(result.data);
    });
  }, []);

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
          <TextField
            select
            label="Clinic"
            size="small"
            value={clinicId}
            onChange={(event) => {
              const nextClinicId = event.target.value;
              setClinicId(nextClinicId);
              loadSummaries(visibleMonth, nextClinicId);
            }}
            disabled={clinics.length === 0}
            helperText={
              clinics.length === 0 ? "Add a clinic before viewing working days." : undefined
            }
            sx={{ minWidth: 260, mb: 1.5 }}
          >
            <MenuItem value="">
              <em>Select a clinic</em>
            </MenuItem>
            {clinics.map((clinic) => (
              <MenuItem key={clinic.id} value={String(clinic.id)}>
                {clinic.name}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {clinicId
              ? "Each day shows verified bookings / total slots. Click a day to view patients by time slot."
              : "Select a clinic to show verified bookings / total slots on each day."}
          </Typography>
          {loadError ? (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
              {loadError}
            </Typography>
          ) : null}
        </Box>
        <Box ref={calendarRef} onClick={handleCalendarClick} sx={{ cursor: "pointer", px: 2, pb: 2 }}>
          <EventCalendar
            events={events}
            views={["month"]}
            defaultView="month"
            defaultVisibleDate={parseIsoDate(initialVisibleDate)}
            onVisibleDateChange={(visibleDate) => {
              const date =
                visibleDate instanceof Date ? visibleDate : new Date(visibleDate as string | number);
              setVisibleMonth(date);
              loadSummaries(date, clinicId);
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
        clinicId={selectedClinicId}
        onClose={() => setPatientsOpen(false)}
      />
    </>
  );
}
