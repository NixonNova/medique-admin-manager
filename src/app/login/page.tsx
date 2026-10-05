import type { Metadata } from "next";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Medique Admin Manager",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Paper elevation={3} className="w-full max-w-md p-8 sm:p-10">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.14em] text-teal-700">
          Medique Admin Manager
        </p>
        <Typography variant="h4" component="h1" className="mb-6">
          Sign in
        </Typography>
        <LoginForm />
      </Paper>
    </main>
  );
}
