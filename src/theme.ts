"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  cssVariables: true,
  typography: {
    fontFamily: "var(--font-roboto), sans-serif",
  },
  palette: {
    primary: {
      main: "#0f766e",
    },
    background: {
      default: "#f4f7fb",
    },
  },
});

export default theme;
