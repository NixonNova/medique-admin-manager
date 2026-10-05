"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { authClient } from "@/lib/auth-client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await authClient.signIn.email({
      email,
      password,
    });

    if (result.error) {
      setError(result.error.message ?? "Could not sign in.");
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <Stack spacing={2}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          fullWidth
        />
        <Button type="submit" variant="contained" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </Stack>
    </form>
  );
}
