"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function HelloPanel() {
  const [greeted, setGreeted] = useState(false);

  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="h1">
        Hello World
      </Typography>
      <Typography color="text.secondary">
        {greeted
          ? "Medique Admins Manager is running locally."
          : "Next.js, React, Tailwind CSS, and Material UI are ready."}
      </Typography>
      <div>
        <Button variant="contained" onClick={() => setGreeted((value) => !value)}>
          {greeted ? "Reset" : "Say hello"}
        </Button>
      </div>
    </Stack>
  );
}
