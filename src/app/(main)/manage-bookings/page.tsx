import type { Metadata } from "next";
import ManageBookingsTable from "@/components/ManageBookingsTable";

export const metadata: Metadata = {
  title: "Manage Bookings · Medique Admin Manager",
};

export default function ManageBookingsPage() {
  return (
    <main className="flex flex-1 items-start px-6 py-10 sm:px-10">
      <div className="w-full max-w-5xl">
        <ManageBookingsTable />
      </div>
    </main>
  );
}
