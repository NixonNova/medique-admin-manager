"use client";

import { useEffect, useState, useTransition } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { fetchWorkingDayPatientSchedule } from "@/app/actions/fetch-working-day-patient-schedule";
import type { WorkingDayPatientSchedule } from "@/lib/working-days-store";
import { parseIsoDate } from "@/lib/working-day-schedule";

type WorkingDayPatientsDialogProps = {
  open: boolean;
  date: string | null;
  onClose: () => void;
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
  onClose,
}: WorkingDayPatientsDialogProps) {
  const [schedule, setSchedule] = useState<WorkingDayPatientSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !date) {
      return;
    }

    startTransition(async () => {
      setError(null);
      setSchedule(null);
      const result = await fetchWorkingDayPatientSchedule(date);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSchedule(result.data);
    });
  }, [open, date]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{date ? formatDialogTitle(date) : "Patients"}</DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error ? (
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
                  <TableCell sx={{ fontWeight: 600, width: "36%" }}>Time</TableCell>
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
  );
}
