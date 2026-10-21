export type BookingTableRow = {
  id: string;
  bookedTime: string;
  name: string;
  contactPhoneNumber: string | null;
  clinic: string | null;
  practitioner: string | null;
  bookingSlot: string | null;
  /** Selected slot date is before today and the booking is not verified. */
  expired: boolean;
  verifiedOn: string | null;
  session: string | null;
  verifiedBy: string | null;
};
