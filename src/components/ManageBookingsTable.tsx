"use client";

import { useCallback, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { fetchBookings } from "@/app/actions/list-bookings";
import { toggleBookingVerification } from "@/app/actions/toggle-booking-verification";
import type { BookingTableRow } from "@/lib/bookings-types";
import type { WorkingDaySlotSummary } from "@/lib/working-days-store";
import WorkingDaysCalendar from "@/components/WorkingDaysCalendar";

type ManageBookingsTableProps = {
  initialRows: BookingTableRow[];
  initialTotalCount: number;
  pageSize: number;
  defaultBookingStart: string;
  defaultBookingEnd: string;
  initialWorkingDaySummaries: WorkingDaySlotSummary[];
  workingDaysVisibleDate: string;
};

function VerifiedOnCell({ verifiedOn, session }: Pick<BookingTableRow, "verifiedOn" | "session">) {
  if (!verifiedOn) {
    return <>-</>;
  }

  return (
    <Box>
      <Typography component="span" variant="body2">
        {verifiedOn}
      </Typography>
      {session ? (
        <Typography component="div" variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          session: {session}
        </Typography>
      ) : null}
    </Box>
  );
}

function manageBookingsTabA11yProps(index: number) {
  return {
    id: `manage-bookings-tab-${index}`,
    "aria-controls": `manage-bookings-tabpanel-${index}`,
  };
}

type ManageBookingsTabPanelProps = {
  children: ReactNode;
  index: number;
  value: number;
};

function ManageBookingsTabPanel({ children, index, value }: ManageBookingsTabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`manage-bookings-tabpanel-${index}`}
      aria-labelledby={`manage-bookings-tab-${index}`}
    >
      {value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null}
    </div>
  );
}

const compactTableSx = {
  "& .MuiTableCell-root": {
    py: 0.625,
    px: 1.25,
    fontSize: "0.8125rem",
    lineHeight: 1.35,
  },
  "& .MuiTableCell-head": {
    py: 0.75,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
} as const;

export default function ManageBookingsTable({
  initialRows,
  initialTotalCount,
  pageSize,
  defaultBookingStart,
  defaultBookingEnd,
  initialWorkingDaySummaries,
  workingDaysVisibleDate,
}: ManageBookingsTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [bookingStart, setBookingStart] = useState(defaultBookingStart);
  const [bookingEnd, setBookingEnd] = useState(defaultBookingEnd);
  const [appliedStart, setAppliedStart] = useState(defaultBookingStart);
  const [appliedEnd, setAppliedEnd] = useState(defaultBookingEnd);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, startLoadTransition] = useTransition();
  const [activeTab, setActiveTab] = useState(0);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const busy = isPending || isLoading;

  const loadPage = useCallback(
    (nextPage: number, start: string, end: string) => {
      startLoadTransition(async () => {
        setFilterError(null);
        const result = await fetchBookings({
          page: nextPage,
          pageSize,
          bookingStart: start || undefined,
          bookingEnd: end || undefined,
        });
        if (!result.ok) {
          setFilterError(result.error);
          return;
        }
        setRows(result.data.rows);
        setTotalCount(result.data.totalCount);
        setPage(result.data.page);
      });
    },
    [pageSize],
  );

  function handleApplyFilter() {
    setAppliedStart(bookingStart);
    setAppliedEnd(bookingEnd);
    loadPage(1, bookingStart, bookingEnd);
  }

  function handleClearFilter() {
    setBookingStart("");
    setBookingEnd("");
    setAppliedStart("");
    setAppliedEnd("");
    setFilterError(null);
    loadPage(1, "", "");
  }

  function handlePageChange(_: ChangeEvent<unknown>, value: number) {
    loadPage(value, appliedStart, appliedEnd);
  }

  function handleVerificationChange(bookingId: string, verified: boolean) {
    setPendingId(bookingId);
    startTransition(async () => {
      const result = await toggleBookingVerification(bookingId, verified);
      setPendingId(null);
      if (result.ok) {
        setRows((current) => current.map((row) => (row.id === bookingId ? result.row : row)));
      } else {
        setFilterError(result.error);
      }
    });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1">
        Manage Bookings
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={activeTab}
          onChange={(_event, newValue: number) => setActiveTab(newValue)}
          aria-label="Manage bookings sections"
        >
          <Tab label="Verification" {...manageBookingsTabA11yProps(0)} />
          <Tab label="Working Days" {...manageBookingsTabA11yProps(1)} />
        </Tabs>
      </Box>

      <ManageBookingsTabPanel value={activeTab} index={0}>
        <Stack spacing={2}>
          <Paper elevation={0} variant="outlined" sx={{ p: 1.5 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              useFlexGap
              sx={{ flexWrap: "wrap", alignItems: { xs: "stretch", sm: "flex-end" } }}
            >
              <TextField
                label="Booking from"
                type="date"
                size="small"
                value={bookingStart}
                onChange={(event) => setBookingStart(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: { xs: "100%", sm: 160 } }}
              />
              <TextField
                label="Booking to"
                type="date"
                size="small"
                value={bookingEnd}
                onChange={(event) => setBookingEnd(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: { xs: "100%", sm: 160 } }}
              />
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" disabled={busy} onClick={handleApplyFilter}>
                  Apply
                </Button>
                <Button size="small" variant="outlined" disabled={busy} onClick={handleClearFilter}>
                  Clear
                </Button>
              </Stack>
            </Stack>
     
            {filterError ? (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
                {filterError}
              </Typography>
            ) : null}
          </Paper>

          <TableContainer component={Paper} elevation={1} sx={{ overflow: "hidden", opacity: busy ? 0.72 : 1 }}>
            <Table size="small" aria-label="Bookings" sx={compactTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Booking time</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Verified on</TableCell>
                  <TableCell>Verified by</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 2, color: "text.secondary" }}>
                      No bookings match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const verified = row.verifiedOn !== null;
                    const rowBusy = isPending && pendingId === row.id;

                    return (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.bookedTime}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>
                          <VerifiedOnCell verifiedOn={row.verifiedOn} session={row.session} />
                        </TableCell>
                        <TableCell>{row.verifiedBy ?? "-"}</TableCell>
                        <TableCell align="right" sx={{ py: 0.25, width: 48 }}>
                          <Checkbox
                            size="small"
                            checked={verified}
                            disabled={busy || rowBusy}
                            onChange={(_, checked) => handleVerificationChange(row.id, checked)}
                            sx={{ p: 0.25 }}
                            slotProps={{
                              input: {
                                "aria-label": `Toggle verification for ${row.name}`,
                              },
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {totalCount === 0
                ? "0 bookings"
                : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} of ${totalCount}`}
            </Typography>
            {totalCount > pageSize ? (
              <Pagination
                size="small"
                page={page}
                count={pageCount}
                onChange={handlePageChange}
                disabled={busy}
                color="primary"
              />
            ) : null}
          </Box>
        </Stack>
      </ManageBookingsTabPanel>

      <ManageBookingsTabPanel value={activeTab} index={1}>
        <WorkingDaysCalendar
          initialSummaries={initialWorkingDaySummaries}
          initialVisibleDate={workingDaysVisibleDate}
        />
      </ManageBookingsTabPanel>
    </Stack>
  );
}
