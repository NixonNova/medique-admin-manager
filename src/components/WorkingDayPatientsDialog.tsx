"use client";

import { useEffect, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { cancelWorkingDayBookings } from "@/app/actions/cancel-working-day-bookings";
import { fetchWorkingDayPatientSchedule } from "@/app/actions/fetch-working-day-patient-schedule";
import type { WorkingDayPatientSchedule } from "@/lib/working-days-store";
import { parseIsoDate } from "@/lib/working-day-schedule";

type WorkingDayPatientsDialogProps = {
  open: boolean;
  date: string | null;
  clinicId: number | null;
  onClose: () => void;
  onBookingsChanged?: () => void;
};

function formatDialogTitle(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function WorkingDayPatientsDialog({
  open,
  date,
  clinicId,
  onClose,
  onBookingsChanged,
}: WorkingDayPatientsDialogProps) {
  const [schedule, setSchedule] = useState<WorkingDayPatientSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();

  const hasVerifiedPatients = Boolean(
    schedule &&
      schedule.date === date &&
      schedule.timeSlots.some((slot) => slot.patients.length > 0),
  );

  useEffect(() => {
    if (!open || !date || clinicId === null) {
      return;
    }

    setError(null);
    setCancelError(null);
    setConfirmOpen(false);
    setSchedule(null);

    startTransition(async () => {
      const result = await fetchWorkingDayPatientSchedule(date, clinicId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSchedule(result.data);
    });
  }, [open, date, clinicId]);

  function handleCancelWholeDay() {
    if (!date || clinicId === null || isCancelling || !hasVerifiedPatients) {
      return;
    }
    setConfirmOpen(true);
  }

  function handleConfirmCancel() {
    if (!date || clinicId === null || isCancelling) {
      return;
    }

    setConfirmOpen(false);
    startCancelTransition(async () => {
      setCancelError(null);
      const result = await cancelWorkingDayBookings(date, clinicId);
      if (!result.ok) {
        setCancelError(result.error);
        return;
      }

      const refreshed = await fetchWorkingDayPatientSchedule(date, clinicId);
      if (!refreshed.ok) {
        setCancelError(refreshed.error);
        return;
      }

      setSchedule(refreshed.data);
      onBookingsChanged?.();
    });
  }

  return (
    <>
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box component="span">{date ? formatDialogTitle(date) : "Patients"}</Box>
        <Button
          color="error"
          variant="contained"
          size="small"
          disabled={!date || clinicId === null || isPending || isCancelling || !hasVerifiedPatients}
          onClick={handleCancelWholeDay}
          sx={{ flexShrink: 0 }}
        >
          Cancel Whole Day
        </Button>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {cancelError ? (
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            {cancelError}
          </Typography>
        ) : null}
        {clinicId === null ? (
          <Typography variant="body2" color="text.secondary">
            Select a clinic to view patients.
          </Typography>
        ) : error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : isPending ? (
          <Typography variant="body2" color="text.secondary">
            Loading schedule…
          </Typography>
        ) : schedule && schedule.timeSlots.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No working day schedule for this date.
          </Typography>
        ) : schedule ? (
          <TableContainer>
            <Table size="small" aria-label="Patients by time slot">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: "24%" }}>Time</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: "32%" }}>Practitioner</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Patients</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedule.timeSlots.map((slot) => (
                  <TableRow key={slot.timeLabel}>
                    <TableCell sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                      {slot.timeLabel}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: "top" }}>
                      {slot.practitionerName}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: "top" }}>
                      {slot.patients.length === 0
                        ? null
                        : slot.patients.map((name, index) => (
                            <Typography
                              key={`${slot.timeLabel}-${index}-${name}`}
                              variant="body2"
                              component="div"
                            >
                              {index + 1}.{name}
                            </Typography>
                          ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}
      </DialogContent>
    </Dialog>
    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Are You sure?</DialogTitle>
      <DialogActions>
        <Button onClick={() => setConfirmOpen(false)}>No</Button>
        <Button color="error" variant="contained" onClick={handleConfirmCancel}>
          Yes
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
