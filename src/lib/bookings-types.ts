export type BookingTableRow = {
  id: string;
  bookedTime: string;
  name: string;
  verifiedOn: string | null;
  session: string | null;
  verifiedBy: string | null;
};
