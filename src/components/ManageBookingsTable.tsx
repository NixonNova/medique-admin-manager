"use client";

import { useCallback, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
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
import { setBookingUnverifiedStatus } from "@/app/actions/set-booking-unverified-status";
import { toggleBookingVerification } from "@/app/actions/toggle-booking-verification";
import {
  DEFAULT_UNVERIFIED_STATUS,
  UNVERIFIED_STATUS_OPTIONS,
  isUnverifiedStatus,
  type BookingTableRow,
  type UnverifiedStatus,
} from "@/lib/bookings-types";
import type { Clinic } from "@/lib/clinics";
import WorkingDaysCalendar from "@/components/WorkingDaysCalendar";

type ManageBookingsTableProps = {
  initialRows: BookingTableRow[];
  initialTotalCount: number;
  pageSize: number;
  defaultBookingStart: string;
  defaultBookingEnd: string;
  clinics: Clinic[];
  workingDaysVisibleDate: string;
};

const statusChipSx = {
  height: 20,
  "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" },
} as const;

function BookingSlotCell({ bookingSlot, expired }: Pick<BookingTableRow, "bookingSlot" | "expired">) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center" }}>
      <span>{bookingSlot ?? "-"}</span>
      {expired ? (
        <Chip label="expired booking" size="small" color="warning" variant="outlined" sx={statusChipSx} />
      ) : null}
    </Stack>
  );
}

function VerifiedOnCell({ verifiedOn }: Pick<BookingTableRow, "verifiedOn">) {
  if (!verifiedOn) {
    return <>-</>;
  }

  return <Chip label={verifiedOn} size="small" color="success" variant="outlined" sx={statusChipSx} />;
}

function StackedCell({ primary, secondary }: { primary: ReactNode; secondary: ReactNode }) {
  return (
    <Stack spacing={0.125}>
      <Box component="span" sx={{ lineHeight: 1.35 }}>
        {primary}
      </Box>
      <Typography
        component="span"
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", lineHeight: 1.3, whiteSpace: "nowrap" }}
      >
        {secondary}
      </Typography>
    </Stack>
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

const verificationOptionSx = {
  m: 0,
  gap: 0.5,
  "& .MuiFormControlLabel-label": {
    lineHeight: 1,
  },
  "&.Mui-disabled .MuiChip-root": {
    opacity: 0.5,
  },
} as const;

function verificationRadioSx(color: "error.main" | "success.main") {
  return {
    p: 0.25,
    color,
    "&.Mui-checked": { color },
    "&.Mui-disabled": { color: "action.disabled" },
  };
}

function displayedUnverifiedStatus(unverifiedStatus: string | null): UnverifiedStatus {
  return unverifiedStatus && isUnverifiedStatus(unverifiedStatus)
    ? unverifiedStatus
    : DEFAULT_UNVERIFIED_STATUS;
}

function UnverifiedStatusSelect({
  unverifiedStatus,
  disabled,
  onChange,
}: {
  unverifiedStatus: string | null;
  disabled: boolean;
  onChange: (unverifiedStatus: UnverifiedStatus) => void;
}) {
  return (
    <TextField
      select
      hiddenLabel
      size="small"
      value={displayedUnverifiedStatus(unverifiedStatus)}
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value;
        if (isUnverifiedStatus(next)) {
          onChange(next);
        }
      }}
      slotProps={{
        select: {
          inputProps: { "aria-label": "Unverified status" },
        },
      }}
      sx={{
        width: 148,
        "& .MuiInputBase-root": { fontSize: "0.75rem" },
        "& .MuiSelect-select": { py: 0.25, pl: 1 },
      }}
    >
      {UNVERIFIED_STATUS_OPTIONS.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      ))}
    </TextField>
  );
}

function VerificationAction({
  bookingId,
  name,
  verified,
  disabled,
  onChange,
  unverifiedStatusControl,
}: {
  bookingId: string;
  name: string;
  verified: boolean;
  disabled: boolean;
  onChange: (bookingId: string, verified: boolean) => void;
  unverifiedStatusControl?: ReactNode;
}) {
  return (
    <RadioGroup
      row
      name={`booking-verification-${bookingId}`}
      aria-label={`Verification for ${name}`}
      value={verified ? "verified" : "unverified"}
      onChange={(event) => onChange(bookingId, event.target.value === "verified")}
      sx={{ flexWrap: "nowrap", columnGap: 1.5, alignItems: "center" }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Radio
          value="unverified"
          size="small"
          disabled={disabled}
          slotProps={{ input: { "aria-label": "Unverified" } }}
          sx={verificationRadioSx("error.main")}
        />
        {unverifiedStatusControl}
      </Stack>
      <FormControlLabel
        value="verified"
        disabled={disabled}
        control={<Radio size="small" sx={verificationRadioSx("success.main")} />}
        label={<Chip label="OK" size="small" color="success" variant="outlined" sx={statusChipSx} />}
        sx={verificationOptionSx}
      />
    </RadioGroup>
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
  clinics,
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

  function handleReload() {
    loadPage(page, appliedStart, appliedEnd);
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

  function handleUnverifiedStatusChange(bookingId: string, unverifiedStatus: UnverifiedStatus) {
    setPendingId(bookingId);
    startTransition(async () => {
      const result = await setBookingUnverifiedStatus(bookingId, unverifiedStatus);
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
              sx={{ width: "100%", flexWrap: "wrap", alignItems: { xs: "stretch", sm: "flex-end" } }}
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
              <Button size="small" variant="contained" disabled={busy} onClick={handleApplyFilter}>
                Apply
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={busy}
                onClick={handleReload}
                sx={{ alignSelf: "flex-end", ml: { sm: "auto" } }}
              >
                Reload
              </Button>
            </Stack>
     
            {filterError ? (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
                {filterError}
              </Typography>
            ) : null}
          </Paper>

          <TableContainer component={Paper} elevation={1} sx={{ overflowX: "auto", opacity: busy ? 0.72 : 1 }}>
            <Table size="small" aria-label="Bookings" sx={compactTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Booking time</TableCell>
                  <TableCell>Name/Phone</TableCell>
                  <TableCell>Clinic/Practitioner</TableCell>
                  <TableCell>Booking Slot</TableCell>
                  <TableCell>Verified on/by</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 2, color: "text.secondary" }}>
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
                        <TableCell>
                          <StackedCell primary={row.name} secondary={row.contactPhoneNumber ?? "-"} />
                        </TableCell>
                        <TableCell>
                          <StackedCell primary={row.clinic ?? "-"} secondary={row.practitioner ?? "-"} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <BookingSlotCell bookingSlot={row.bookingSlot} expired={row.expired} />
                        </TableCell>
                        <TableCell>
                          <StackedCell
                            primary={<VerifiedOnCell verifiedOn={row.verifiedOn} />}
                            secondary={row.verifiedBy ?? "-"}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <VerificationAction
                            bookingId={row.id}
                            name={row.name}
                            verified={verified}
                            disabled={busy || rowBusy || row.expired}
                            onChange={handleVerificationChange}
                            unverifiedStatusControl={
                              <UnverifiedStatusSelect
                                unverifiedStatus={row.unverifiedStatus}
                                disabled={busy || rowBusy || verified}
                                onChange={(unverifiedStatus) =>
                                  handleUnverifiedStatusChange(row.id, unverifiedStatus)
                                }
                              />
                            }
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
        <WorkingDaysCalendar clinics={clinics} initialVisibleDate={workingDaysVisibleDate} />
      </ManageBookingsTabPanel>
    </Stack>
  );
}
