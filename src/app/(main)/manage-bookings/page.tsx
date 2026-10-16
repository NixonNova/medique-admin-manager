import type { Metadata } from "next";
import ManageBookingsTable from "@/components/ManageBookingsTable";
import { listBookings } from "@/lib/bookings-store";
import { listClinics } from "@/lib/clinics";
import { addCalendarDays, formatIsoDate, startOfToday } from "@/lib/working-day-schedule";

export const metadata: Metadata = {
  title: "Manage Bookings · Medique Admin Manager",
};

export default async function ManageBookingsPage() {
  const todayDate = startOfToday();
  const today = formatIsoDate(todayDate);
  const weekStart = formatIsoDate(addCalendarDays(todayDate, -7));
  const clinics = await listClinics();
  const { rows, totalCount, pageSize } = await listBookings({
    bookingStart: weekStart,
    bookingEnd: today,
  });

  return (
    <main className="flex flex-1 items-start px-6 py-10 sm:px-10">
      <div className="w-full max-w-5xl">
        <ManageBookingsTable
          initialRows={rows}
          initialTotalCount={totalCount}
          pageSize={pageSize}
          defaultBookingStart={weekStart}
          defaultBookingEnd={today}
          clinics={clinics}
          workingDaysVisibleDate={today}
        />
      </div>
    </main>
  );
}
