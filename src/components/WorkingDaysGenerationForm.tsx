"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export type WorkingDaysGenerationValues = {
  workingStartTime: string;
  breakStartTime: string;
  breakLengthMinutes: number;
  sessionsPerDay: number;
  sessionLengthMinutes: number;
  concurrentPatients: number;
};

const DEFAULT_VALUES: WorkingDaysGenerationValues = {
  workingStartTime: "10:00",
  breakStartTime: "14:00",
  breakLengthMinutes: 60,
  sessionsPerDay: 16,
  sessionLengthMinutes: 60,
  concurrentPatients: 2,
};

function parseTimeToMinutes(value: string): number | null {
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

function formatMinutesAsTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function workingDayEndMinutes(
  workingStartMinutes: number,
  sessionsPerDay: number,
  sessionLengthMinutes: number,
  concurrentPatients: number,
  breakLengthMinutes: number,
): number {
  const blocks = sessionsPerDay / concurrentPatients;
  return workingStartMinutes + blocks * sessionLengthMinutes + breakLengthMinutes;
}

function validateWorkingDaysForm(values: WorkingDaysGenerationValues): string | null {
  const workingStart = parseTimeToMinutes(values.workingStartTime);
  if (workingStart === null) {
    return "Enter a valid working start time (HH:MM).";
  }

  const breakStart = parseTimeToMinutes(values.breakStartTime);
  if (breakStart === null) {
    return "Enter a valid break start time (HH:MM).";
  }

  if (
    !Number.isInteger(values.breakLengthMinutes) ||
    values.breakLengthMinutes <= 0
  ) {
    return "Break length must be a whole number of minutes greater than 0.";
  }

  if (!Number.isInteger(values.concurrentPatients) || values.concurrentPatients < 1) {
    return "Concurrent patients must be a whole number of at least 1.";
  }

  if (!Number.isInteger(values.sessionsPerDay) || values.sessionsPerDay <= 0) {
    return "Sessions per day must be a whole number greater than 0.";
  }

  if (values.sessionsPerDay % values.concurrentPatients !== 0) {
    return "Sessions per day must divide evenly by concurrent patients.";
  }

  if (!Number.isInteger(values.sessionLengthMinutes) || values.sessionLengthMinutes <= 0) {
    return "Session length must be a whole number of minutes greater than 0.";
  }

  const workingEnd = workingDayEndMinutes(
    workingStart,
    values.sessionsPerDay,
    values.sessionLengthMinutes,
    values.concurrentPatients,
    values.breakLengthMinutes,
  );

  if (breakStart < workingStart) {
    return "Break start time must be within working hours (not before working start).";
  }

  const breakEnd = breakStart + values.breakLengthMinutes;
  if (breakEnd > workingEnd) {
    return `Break must fit within working hours (day ends around ${formatMinutesAsTime(workingEnd)}).`;
  }

  return null;
}

type WorkingDaysGenerationFormProps = {
  /** Reset defaults when the selected account changes. */
  accountKey: string;
  onSave?: (values: WorkingDaysGenerationValues) => void | Promise<void>;
};

export default function WorkingDaysGenerationForm({
  accountKey,
  onSave,
}: WorkingDaysGenerationFormProps) {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setValues(DEFAULT_VALUES);
    setError(null);
    setSuccess(null);
  }, [accountKey]);

  const fieldErrors = useMemo(() => {
    const messages: Partial<Record<keyof WorkingDaysGenerationValues, string>> = {};
    if (values.sessionsPerDay > 0 && values.concurrentPatients >= 1) {
      if (values.sessionsPerDay % values.concurrentPatients !== 0) {
        messages.sessionsPerDay = "Must divide evenly by concurrent patients.";
      }
    }
    return messages;
  }, [values.concurrentPatients, values.sessionsPerDay]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateWorkingDaysForm(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!onSave) {
      setSuccess("All fields are valid.");
      return;
    }

    setPending(true);
    try {
      await onSave(values);
      setSuccess("Working days settings saved.");
    } catch {
      setError("Could not save working days settings.");
    } finally {
      setPending(false);
    }
  }

  function patch<K extends keyof WorkingDaysGenerationValues>(
    key: K,
    value: WorkingDaysGenerationValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSuccess(null);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack spacing={2.5} sx={{ maxWidth: 420 }}>
        

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

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

        <TextField
          label="Sessions per day"
          name="sessionsPerDay"
          type="number"
          value={values.sessionsPerDay}
          onChange={(event) => patch("sessionsPerDay", Number(event.target.value) || 0)}
          required
          fullWidth
          disabled={pending}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
          error={Boolean(fieldErrors.sessionsPerDay)}
          helperText={
            fieldErrors.sessionsPerDay ??
            "Total patients per day; must divide evenly by concurrent patients."
          }
        />

        <TextField
          label="Concurrent patients"
          name="concurrentPatients"
          type="number"
          value={values.concurrentPatients}
          onChange={(event) =>
            patch("concurrentPatients", Number(event.target.value) || 0)
          }
          required
          fullWidth
          disabled={pending}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
          helperText="Patients the doctor handles at the same time."
        />

        <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: "flex-start" }}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </Stack>
    </form>
  );
}
