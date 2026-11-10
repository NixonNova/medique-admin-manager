"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { deleteWorkingDays } from "@/app/actions/delete-working-days";
import { fetchWorkingDaySummaries } from "@/app/actions/list-working-day-summaries";
import type { WorkingDaySlotSummary } from "@/lib/working-days-store";

type DeleteWorkingDaysDialogProps = {
  open: boolean;
  clinicId: number | null;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onDeleted: () => void;
};

function formatWorkingDayDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DeleteWorkingDaysDialog({
  open,
  clinicId,
  startDate,
  endDate,
  onClose,
  onDeleted,
}: DeleteWorkingDaysDialogProps) {
  const [rows, setRows] = useState<WorkingDaySlotSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    if (!open || clinicId === null) {
      return;
    }

    let cancelled = false;
    setRows(null);
    setError(null);
    setDeleting(false);

    void (async () => {
      try {
        const result = await fetchWorkingDaySummaries(startDate, endDate, clinicId);
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setError(result.error);
          setRows([]);
          return;
        }
        setRows(result.data);
      } catch {
        if (!cancelled) {
          setError("Could not load working days.");
          setRows([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, clinicId, startDate, endDate]);

  function handleClose() {
    if (deleting) {
      return;
    }
    onClose();
  }

  async function handleDelete() {
    if (clinicId === null || deleting || !rows || rows.length === 0) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const result = await deleteWorkingDays({ clinicId, startDate, endDate });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccessOpen(true);
    } catch {
      setError("Could not delete working days.");
    } finally {
      setDeleting(false);
    }
  }

  const canDelete = Boolean(rows && rows.length > 0) && !deleting;

  function finishSuccess() {
    setSuccessOpen(false);
    onDeleted();
  }

  return (
    <>
    <Dialog
      open={open && !successOpen}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="delete-working-days-title"
    >
      <DialogTitle id="delete-working-days-title">Delete Working Days</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        {rows === null ? (
          <Typography variant="body2" color="text.secondary">
            Loading working days…
          </Typography>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No working days in this date range.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" aria-label="Working days to delete">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Total Slot
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <span>{formatWorkingDayDate(row.date)}</span>
                        {row.verifiedBookingCount > 0 ? (
                          <Typography variant="caption" color="warning.main">
                            This day contains verified booking, it cannot be deleted
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{row.totalSlotCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {rows !== null && rows.length > 0 ? (
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Typography variant="body2" color="warning.main">
              This action will delete all the Working Days data and cannot be recovered
            </Typography>
            <Typography variant="body2">
              Delete function still can run but day with verified booking will be skipped.
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={handleDelete}
          disabled={!canDelete}
        >
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog
      open={successOpen}
      onClose={finishSuccess}
      aria-labelledby="delete-working-days-success-title"
    >
      <DialogTitle id="delete-working-days-success-title">Success</DialogTitle>
      <DialogContent>
        <DialogContentText>Working days deleted successfully</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={finishSuccess} autoFocus>
          OK
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
