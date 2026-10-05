"use client";

import { FormEvent, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { authClient } from "@/lib/auth-client";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);

    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });

    if (result.error) {
      setError(result.error.message ?? "Could not change the password.");
      setPending(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setSuccess("Password updated.");
    setPending(false);
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          Reset Password
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          fullWidth
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          fullWidth
          helperText="At least 8 characters."
        />
        <div>
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? "Saving..." : "Update password"}
          </Button>
        </div>
      </Stack>
    </form>
  );
}
