"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlineTwoToneIcon from "@mui/icons-material/InfoOutlineTwoTone";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  checkWorkingDayTimeSlots,
  generateWorkingDays,
} from "@/app/actions/generate-working-days";
import type { Clinic } from "@/lib/clinics";
import {
  computeDailyTimetable,
  earliestGenerationDate,
  enumerateGenerationDates,
  type DailyTimetable,
  formatIsoDate,
  parseCalendarDate,
  parseTimeToMinutes,
  formatMinutesAsTime,
  isAllowedGenerationStart,
  validateWorkingDaysForm,
  WORKING_WEEKDAYS,
  type WorkingWeekdayKey,
  type WorkingDaysGenerationValues,
} from "@/lib/working-day-schedule";

export type { WorkingDaysGenerationValues };

function createDefaultValues(): WorkingDaysGenerationValues {
  return {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    workingStartTime: "10:00",
    addBreakTime: false,
    breakStartTime: "14:00",
    breakLengthMinutes: 60,
    sessionsPerDay: 16,
    sessionLengthMinutes: 60,
    concurrentPatients: 2,
    daysToGenerate: 10,
    generationStartDate: formatIsoDate(earliestGenerationDate()),
  };
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatGenerationCriteria(options: {
  sessionsPerDay: number;
  concurrentPatients: number;
  timetable: DailyTimetable | null;
  generationStartDay: Date | null;
  generationEndDay: Date | null;
}): string {
  const lines = [
    "Generate criteria:",
    "",
    `Total daily patients : ${options.sessionsPerDay}`,
    `Seat per hourly slot: ${options.concurrentPatients}`,
    `Total hourly slot : ${options.timetable?.slotCount ?? 0}`,
    "",
  ];

  if (!options.timetable) {
    lines.push("Enter valid session settings to preview the daily schedule.");
    return lines.join("\n");
  }

  if (!options.generationStartDay || !options.generationEndDay) {
    lines.push("Select at least one weekday to preview the generation range.");
    return lines.join("\n");
  }

  lines.push(
    `Last slot start: ${formatMinutesAsTime(options.timetable.lastSlotStartMinutes)}`,
    `Last working day generated: ${formatDisplayDate(options.generationEndDay)}`,
    "",
    `Generate from ${formatDisplayDate(options.generationStartDay)} to ${formatDisplayDate(options.generationEndDay)}`,
  );
  return lines.join("\n");
}

function lastSlotEmptySpots(sessionsPerDay: number, concurrentPatients: number): number {
  if (
    !Number.isInteger(sessionsPerDay) ||
    sessionsPerDay <= 0 ||
    !Number.isInteger(concurrentPatients) ||
    concurrentPatients < 1
  ) {
    return 0;
  }
  const remainder = sessionsPerDay % concurrentPatients;
  if (remainder === 0) {
    return 0;
  }
  return concurrentPatients - remainder;
}

function concurrentPatientsCapacityHelper(
  sessionsPerDay: number,
  concurrentPatients: number,
): { message: string; warning: boolean } | null {
  if (
    !Number.isInteger(sessionsPerDay) ||
    sessionsPerDay <= 0 ||
    !Number.isInteger(concurrentPatients) ||
    concurrentPatients < 1
  ) {
    return null;
  }
  const totalSlots = Math.ceil(sessionsPerDay / concurrentPatients);
  const emptySpots = lastSlotEmptySpots(sessionsPerDay, concurrentPatients);
  if (emptySpots === 0) {
    return { message: `Total time slot ${totalSlots}`, warning: false };
  }
  const spotLabel = emptySpots === 1 ? "seat" : "seats";
  return {
    message: `Total time slot ${totalSlots}, last time slot has ${emptySpots} empty ${spotLabel}`,
    warning: true,
  };
}

type WorkingDaysGenerationFormProps = {
  /** Reset defaults when the selected account changes. */
  accountKey: string;
  /** User stored on each generated WorkingDayDetail row. */
  userId: string;
  clinics: Clinic[];
};

export default function WorkingDaysGenerationForm({
  accountKey,
  userId,
  clinics,
}: WorkingDaysGenerationFormProps) {
  const [values, setValues] = useState(createDefaultValues);
  const [clinicId, setClinicId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkNotice, setCheckNotice] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"check" | "generate" | null>(null);
  const pending = pendingAction !== null;
  const earliestStartDate = formatIsoDate(earliestGenerationDate());

  useEffect(() => {
    setValues(createDefaultValues());
    setClinicId("");
    setError(null);
    setCheckNotice(null);
    setSuccessOpen(false);
  }, [accountKey]);

  const concurrentPatientsHelper = useMemo(
    () =>
      concurrentPatientsCapacityHelper(values.sessionsPerDay, values.concurrentPatients),
    [values.concurrentPatients, values.sessionsPerDay],
  );

  const generationAnchorDay = useMemo(() => {
    const start = parseCalendarDate(values.generationStartDate);
    if (!start || !isAllowedGenerationStart(start)) {
      return null;
    }
    return start;
  }, [values.generationStartDate]);

  const previewGenerationDates = useMemo(
    () =>
      generationAnchorDay
        ? enumerateGenerationDates(generationAnchorDay, values.daysToGenerate, values)
        : [],
    [generationAnchorDay, values],
  );

  const generationStartDay = previewGenerationDates[0] ?? null;
  const generationEndDay =
    previewGenerationDates[previewGenerationDates.length - 1] ?? null;

  const generationCriteria = useMemo(() => {
    const workingStart = parseTimeToMinutes(values.workingStartTime);
    const breakStart = values.addBreakTime
      ? parseTimeToMinutes(values.breakStartTime)
      : null;
    const timetable =
      workingStart === null || (values.addBreakTime && breakStart === null)
        ? null
        : computeDailyTimetable(
            workingStart,
            breakStart,
            values.breakLengthMinutes,
            values.sessionsPerDay,
            values.sessionLengthMinutes,
            values.concurrentPatients,
          );

    return formatGenerationCriteria({
      sessionsPerDay: values.sessionsPerDay,
      concurrentPatients: values.concurrentPatients,
      timetable,
      generationStartDay,
      generationEndDay,
    });
  }, [generationEndDay, generationStartDay, values]);

  function patchWeekday(key: WorkingWeekdayKey, checked: boolean) {
    patch(key, checked);
  }

  function readGenerationInput():
    | { clinicId: number }
    | { error: string } {
    const selectedClinicId = Number(clinicId);
    if (!Number.isInteger(selectedClinicId) || selectedClinicId < 1) {
      return { error: "Select a clinic." };
    }
    const validationError = validateWorkingDaysForm(values);
    if (validationError) {
      return { error: validationError };
    }
    return { clinicId: selectedClinicId };
  }

  async function onCheckTimeSlots() {
    if (pending) {
      return;
    }
    setError(null);
    setCheckNotice(null);
    setSuccessOpen(false);

    const input = readGenerationInput();
    if ("error" in input) {
      setError(input.error);
      return;
    }

    setPendingAction("check");
    try {
      const result = await checkWorkingDayTimeSlots({
        values,
        clinicId: input.clinicId,
        userId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCheckNotice("Time slots are available.");
    } catch {
      setError("Could not check time slots.");
    } finally {
      setPendingAction(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setCheckNotice(null);
    setSuccessOpen(false);

    const input = readGenerationInput();
    if ("error" in input) {
      setError(input.error);
      return;
    }

    setPendingAction("generate");
    try {
      const result = await generateWorkingDays({
        values,
        clinicId: input.clinicId,
        userId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccessOpen(true);
    } catch {
      setError("Could not generate working days.");
    } finally {
      setPendingAction(null);
    }
  }

  function patch<K extends keyof WorkingDaysGenerationValues>(
    key: K,
    value: WorkingDaysGenerationValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack spacing={2.5} sx={{ width: "100%" }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {checkNotice ? <Alert severity="success">{checkNotice}</Alert> : null}

        <Accordion disableGutters sx={{ width: "100%" }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="daily-schedule-content"
            id="daily-schedule-header"
          >
            <Typography component="span">Criteria</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Working days of the week
                </Typography>
                <Stack
                  direction="row"
                  spacing={0}
                  useFlexGap
                  sx={{ columnGap: 1, rowGap: 0, flexWrap: "wrap" }}
                >
                  {WORKING_WEEKDAYS.map((weekday) => (
                    <FormControlLabel
                      key={weekday.key}
                      control={
                        <Checkbox
                          checked={values[weekday.key]}
                          onChange={(event) =>
                            patchWeekday(weekday.key, event.target.checked)
                          }
                          disabled={pending}
                          name={weekday.key}
                        />
                      }
                      label={weekday.label}
                    />
                  ))}
                </Stack>
              </Box>

              <TextField
                label="Working start time"
                name="workingStartTime"
                type="time"
                value={values.workingStartTime}
                onChange={(event) => patch("workingStartTime", event.target.value)}
                required
                fullWidth
                disabled={pending}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Time the first slot starts (HH:MM)."
              />

              <TextField
                label="Session length (minutes)"
                name="sessionLengthMinutes"
                type="number"
                value={values.sessionLengthMinutes}
                onChange={(event) =>
                  patch("sessionLengthMinutes", Number(event.target.value) || 0)
                }
                required
                fullWidth
                disabled={pending}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                helperText="Length of one session."
              />

<TextField
                label="Patients per day"
                name="sessionsPerDay"
                type="number"
                value={values.sessionsPerDay}
                onChange={(event) => patch("sessionsPerDay", Number(event.target.value) || 0)}
                required
                fullWidth
                disabled={pending}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                helperText="Total patients per day."
              />

              <TextField
                label="Total seats per hour"
                name="concurrentPatients"
                type="number"
                value={values.concurrentPatients}
                onChange={(event) =>
                  patch("concurrentPatients", Number(event.target.value) || 0)
                }
                required
                fullWidth
                disabled={pending}
                slotProps={{
                  htmlInput: { min: 1, step: 1 },
                  formHelperText: concurrentPatientsHelper?.warning
                    ? { sx: { color: "warning.main" } }
                    : undefined,
                }}
                helperText={concurrentPatientsHelper?.message ?? ""}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.addBreakTime}
                    onChange={(event) => patch("addBreakTime", event.target.checked)}
                    disabled={pending}
                    name="addBreakTime"
                  />
                }
                label="Add break time"
              />

              {values.addBreakTime ? (
                <>
                  <TextField
                    label="Break start time"
                    name="breakStartTime"
                    type="time"
                    value={values.breakStartTime}
                    onChange={(event) => patch("breakStartTime", event.target.value)}
                    required
                    fullWidth
                    disabled={pending}
                    slotProps={{ inputLabel: { shrink: true } }}
                    helperText="Daily break start; must fall within working hours."
                  />

                  <TextField
                    label="Break length (minutes)"
                    name="breakLengthMinutes"
                    type="number"
                    value={values.breakLengthMinutes}
                    onChange={(event) =>
                      patch("breakLengthMinutes", Number(event.target.value) || 0)
                    }
                    required
                    fullWidth
                    disabled={pending}
                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                    helperText="Default 60. Slot generation skips this window after break start."
                  />
                </>
              ) : null}

            </Stack>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded disableGutters sx={{ width: "100%" }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="generation-content"
            id="generation-header"
          >
            <Typography component="span">Generate</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2.5}>
              <TextField
                label="Start of generation"
                name="generationStartDate"
                type="date"
                value={values.generationStartDate}
                onChange={(event) => patch("generationStartDate", event.target.value)}
                required
                fullWidth
                disabled={pending}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: earliestStartDate },
                }}
                helperText="Working days are generated from this date forward. Today and earlier dates are not available."
              />

              <TextField
                label="How many working days to generate"
                name="daysToGenerate"
                type="number"
                value={values.daysToGenerate}
                onChange={(event) => patch("daysToGenerate", Number(event.target.value) || 0)}
                required
                fullWidth
                disabled={pending}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
              />

              <TextField
                select
                label="Clinic"
                name="clinicId"
                value={clinicId}
                onChange={(event) => setClinicId(event.target.value)}
                required
                fullWidth
                disabled={pending || clinics.length === 0}
                helperText={
                  clinics.length === 0 ? "Add a clinic before generating working days." : undefined
                }
              >
                {clinics.length === 0 ? (
                  <MenuItem value="" disabled>
                    No clinics
                  </MenuItem>
                ) : (
                  clinics.map((clinic) => (
                    <MenuItem key={clinic.id} value={String(clinic.id)}>
                      {clinic.name}
                    </MenuItem>
                  ))
                )}
              </TextField>

              <Stack direction="row" spacing={1} sx={{ alignItems: "center", alignSelf: "flex-start" }}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={onCheckTimeSlots}
                  disabled={pending || !clinicId}
                  aria-busy={pendingAction === "check"}
                >
                  {pendingAction === "check" ? "Validating…" : "Validate Time Slot"}
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={pending || !clinicId}
                  aria-busy={pendingAction === "generate"}
                >
                  {pendingAction === "generate" ? "Generating…" : "Generate"}
                </Button>
                <Tooltip
                  describeChild
                  arrow
                  placement="bottom-start"
                  title={
                    <Box component="span" sx={{ display: "block", whiteSpace: "pre-line" }}>
                      {generationCriteria}
                    </Box>
                  }
                  slotProps={{
                    tooltip: {
                      sx: { maxWidth: 420, fontSize: "0.875rem", lineHeight: 1.5 },
                    },
                  }}
                >
                  <IconButton type="button" size="small" aria-label="Generation criteria">
                    <InfoOutlineTwoToneIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

            </Stack>
          </AccordionDetails>
        </Accordion>
      </Stack>
      <Dialog
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        aria-labelledby="working-days-success-title"
      >
        <DialogTitle id="working-days-success-title">Success</DialogTitle>
        <DialogContent>
          <DialogContentText>Generating working days successful.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuccessOpen(false)} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </form>
  );
}
