export const UNVERIFIED_STATUS_OPTIONS = ["Pending", "Slot Penuh", "Tidak ada praktek", "Gagal"] as const;

export type UnverifiedStatus = (typeof UNVERIFIED_STATUS_OPTIONS)[number];

export const DEFAULT_UNVERIFIED_STATUS: UnverifiedStatus = "Pending";

export function isUnverifiedStatus(value: string): value is UnverifiedStatus {
  return (UNVERIFIED_STATUS_OPTIONS as readonly string[]).includes(value);
}

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
  /** Status while the booking is unverified. Null displays as Pending. */
  unverifiedStatus: string | null;
};
