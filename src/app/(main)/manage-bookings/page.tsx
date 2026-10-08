import type { Metadata } from "next";
import ManageBookingsTable from "@/components/ManageBookingsTable";
import { listBookings } from "@/lib/bookings-store";
import { addCalendarDays, formatIsoDate, startOfToday } from "@/lib/working-day-schedule";
import { listWorkingDaySlotSummaries } from "@/lib/working-days-store";

export const metadata: Metadata = {
  title: "Manage Bookings · Medique Admin Manager",
};

export default function ManageBookingsPage() {
  const todayDate = startOfToday();
  const today = formatIsoDate(todayDate);
  const weekStart = formatIsoDate(addCalendarDays(todayDate, -7));
  const monthStart = formatIsoDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const monthEnd = formatIsoDate(new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0));
  const workingDaySummaries = listWorkingDaySlotSummaries(monthStart, monthEnd);
  const { rows, totalCount, pageSize } = listBookings({
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
          initialWorkingDaySummaries={workingDaySummaries}
          workingDaysVisibleDate={today}
        />
      </div>
    </main>
  );
}
