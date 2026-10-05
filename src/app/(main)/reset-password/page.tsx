import type { Metadata } from "next";
import Paper from "@mui/material/Paper";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const metadata: Metadata = {
  title: "Reset Password · Medique Admin Manager",
};

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 items-start px-6 py-10 sm:px-10">
      <Paper elevation={1} className="w-full max-w-xl p-8 sm:p-10">
        <ChangePasswordForm />
      </Paper>
    </main>
  );
}
