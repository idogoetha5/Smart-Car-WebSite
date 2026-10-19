import { numericOrderReference } from "@/lib/order-reference";

export interface AdminBooking {
  id: string;
  status: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  source?: string;
  vehicle_id?: string;
  vehicle?: { make?: string; model?: string; year?: number };
  pickup_date?: string;
  dropoff_date?: string;
  pickup_time?: string;
  return_time?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_address?: string;
  return_address?: string;
  created_at?: string;
  total_price?: number;
  total_days?: number;
  price_per_day?: number;
  extras?: string[];
  notes?: string;
  special_requests?: string;
  match_status?: string;
  consent_locale?: string;
  additional_driver_name?: string;
}

export const BOOKING_EXTRAS: Record<string, string> = {
  insurance: "הפחתה או ביטול השתתפות בנזק",
  highway6: "כביש 6 ומנהרות",
  baby_seat: "כיסא בטיחות לילד",
  driver: "נהג נוסף",
};
export interface BookingFilters {
  query: string;
  car: string;
  status: string;
  dateField: "created_at" | "pickup_date" | "dropoff_date";
  from: string;
  to: string;
}
export const EMPTY_BOOKING_FILTERS: BookingFilters = {
  query: "",
  car: "",
  status: "",
  dateField: "pickup_date",
  from: "",
  to: "",
};
const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .trim()
    .toLowerCase();
export function isOfficeBooking(b: AdminBooking) {
  return b.source !== "driver" && b.source !== "phone";
}
export function filterAdminBookings(
  bookings: AdminBooking[],
  f: BookingFilters,
): AdminBooking[] {
  const query = normalize(f.query).replace(/^#/, "");
  const digits = query.replace(/\D/g, "");
  const phoneQuery = digits.length >= 4 && /^[+\d\s()-]+$/.test(query);
  return bookings.filter((b) => {
    if (!isOfficeBooking(b)) return false;
    const name = normalize(
      `${b.customer_name ?? ""} ${b.customer_email ?? ""} ${b.id} ${numericOrderReference(b.id)}`,
    );
    const phone = (b.customer_phone ?? "").replace(/\D/g, "");
    const phoneSuffix =
      digits.startsWith("972") && digits.length >= 11
        ? digits.slice(3)
        : digits;
    if (
      query &&
      !name.includes(query) &&
      !(phoneQuery && (phone.includes(digits) || phone.endsWith(phoneSuffix)))
    )
      return false;
    if (
      f.car &&
      !normalize(`${b.vehicle?.make ?? ""} ${b.vehicle?.model ?? ""}`).includes(
        normalize(f.car),
      )
    )
      return false;
    if (f.status && b.status?.toUpperCase() !== f.status.toUpperCase())
      return false;
    const value = b[f.dateField];
    const day =
      value &&
      f.dateField === "created_at" &&
      Number.isFinite(Date.parse(value))
        ? new Date(value).toLocaleDateString("sv-SE", {
            timeZone: "Asia/Jerusalem",
          })
        : (value?.slice(0, 10) ?? "");
    if ((f.from || f.to) && !day) return false;
    return (!f.from || day >= f.from) && (!f.to || day <= f.to);
  });
}

export function approvalResultMessage(
  status: string,
  emailed: unknown,
): { text: string; ok: boolean } {
  if (status.toUpperCase() !== "CONFIRMED")
    return { text: "ההזמנה סורבה", ok: true };
  if (emailed === true)
    return { text: "ההזמנה אושרה ומייל האישור נשלח ללקוח", ok: true };
  return {
    text: "ההזמנה אושרה. שליחת מייל האישור לא אושרה כרגע; יש לבדוק לפני שליחה נוספת.",
    ok: false,
  };
}
