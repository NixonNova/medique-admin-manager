"use client";

import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { type Dayjs } from "dayjs";

/** Display format for every date field, for example 11 Oct 2026. */
export const APP_DATE_FORMAT = "DD MMM YYYY";

function isoToDayjs(value: string): Dayjs | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const parsed = dayjs(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.isValid() ? parsed : null;
}

type AppDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
  helperText?: ReactNode;
  min?: string;
  sx?: SxProps<Theme>;
};

export default function AppDateField({
  label,
  value,
  onChange,
  name,
  required,
  fullWidth,
  disabled,
  size,
  helperText,
  min,
  sx,
}: AppDateFieldProps) {
  return (
    <DatePicker
      label={label}
      name={name}
      value={isoToDayjs(value)}
      format={APP_DATE_FORMAT}
      disabled={disabled}
      minDate={min ? (isoToDayjs(min) ?? undefined) : undefined}
      onChange={(next) => {
        if (!next) {
          onChange("");
          return;
        }
        if (next.isValid()) {
          onChange(next.format("YYYY-MM-DD"));
        }
      }}
      slotProps={{
        textField: {
          required,
          fullWidth,
          size,
          helperText,
          sx,
        },
        openPickerButton: {
          type: "button",
        },
      }}
    />
  );
}
