"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

type BookingRow = {
  id: string;
  bookedTime: string;
  name: string;
  verified: boolean;
  verifiedOn: string | null;
  session: string | null;
};

const INITIAL_ROWS: BookingRow[] = [
  {
    id: "1",
    bookedTime: "1 Oct 2026",
    name: "BB",
    verified: true,
    verifiedOn: "2 Oct 2026 10:10:10",
    session: "2 Oct 2026 10:00",
  },
  {
    id: "2",
    bookedTime: "3 Oct 2026",
    name: "Alex Chen",
    verified: false,
    verifiedOn: null,
    session: null,
  },
  {
    id: "3",
    bookedTime: "4 Oct 2026",
    name: "Sam Lee",
    verified: true,
    verifiedOn: "4 Oct 2026 14:05:32",
    session: "4 Oct 2026 14:00",
  },
];

function formatVerifiedOn(date: Date) {
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${day} ${month} ${year} ${time}`;
}

function formatSessionStart(date: Date) {
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hour}:${minute}`;
}

function sessionFromVerifiedAt(verifiedAt: Date) {
  const session = new Date(verifiedAt);
  session.setMinutes(0, 0, 0);
  return formatSessionStart(session);
}

export default function ManageBookingsTable() {
  const [rows, setRows] = useState(INITIAL_ROWS);

  function toggleVerification(id: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) {
          return row;
        }
        if (row.verified) {
          return { ...row, verified: false, verifiedOn: null, session: null };
        }
        const now = new Date();
        return {
          ...row,
          verified: true,
          verifiedOn: formatVerifiedOn(now),
          session: sessionFromVerifiedAt(now),
        };
      }),
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Manage Bookings
      </Typography>
      <TableContainer component={Paper} elevation={1}>
        <Table size="medium" aria-label="Bookings">
          <TableHead>
            <TableRow>
              <TableCell>Booked time</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Verified on</TableCell>
              <TableCell>Session</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.bookedTime}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.verified ? "Verified" : "Not verified"}</TableCell>
                <TableCell>{row.verifiedOn ?? "-"}</TableCell>
                <TableCell>{row.session ?? "-"}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" onClick={() => toggleVerification(row.id)}>
                    Toggle verification
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
