import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BookingDetails from "@/components/admin/BookingDetails";
import {
  approvalResultMessage,
  EMPTY_BOOKING_FILTERS,
  filterAdminBookings,
  type AdminBooking,
} from "@/lib/admin-bookings";
import { numericOrderReference } from "@/lib/order-reference";

const booking: AdminBooking = {
  id: "booking-a",
  customer_name: "לקוח לדוגמה",
  customer_phone: "052-123-4567",
  customer_email: "example@example.invalid",
  status: "PENDING",
  pickup_date: "2026-10-20T00:00:00Z",
  dropoff_date: "2026-10-22T00:00:00Z",
  created_at: "2026-10-19T23:30:00Z",
  pickup_time: "09:15",
  return_time: "17:30",
  pickup_location: "הרצל 12, תל אביב",
  dropoff_location: "בן יהודה 14, ירושלים",
  vehicle: { make: "Toyota", model: "Corolla", year: 2025 },
  extras: ["insurance", "baby_seat", "driver"],
  additional_driver_name: "נהג לדוגמה",
  total_price: 850,
  total_days: 2,
  notes: "<script>test</script>",
  consent_locale: "en",
};

describe("mobile booking context", () => {
  it.each([
    "לקוח",
    "example@example.invalid",
    "0521234567",
    "+972 52 123 4567",
    "#" + numericOrderReference(booking.id),
  ])("finds a booking using %s", (query) => {
    expect(
      filterAdminBookings([booking], { ...EMPTY_BOOKING_FILTERS, query }),
    ).toEqual([booking]);
  });
  it("does not match a different phone and excludes driver/phone field jobs", () => {
    expect(
      filterAdminBookings([booking], {
        ...EMPTY_BOOKING_FILTERS,
        query: "0500000000",
      }),
    ).toEqual([]);
    expect(
      filterAdminBookings(
        [
          { ...booking, source: "driver" },
          { ...booking, source: "phone" },
        ],
        EMPTY_BOOKING_FILTERS,
      ),
    ).toEqual([]);
  });
  it("uses the explicitly selected date and Israel day for creation time", () => {
    expect(
      filterAdminBookings([booking], {
        ...EMPTY_BOOKING_FILTERS,
        dateField: "created_at",
        from: "2026-10-20",
        to: "2026-10-20",
      }),
    ).toHaveLength(1);
    expect(
      filterAdminBookings([booking], {
        ...EMPTY_BOOKING_FILTERS,
        dateField: "dropoff_date",
        to: "2026-10-20",
      }),
    ).toHaveLength(0);
    expect(
      filterAdminBookings([booking], {
        ...EMPTY_BOOKING_FILTERS,
        status: "REJECTED",
      }),
    ).toHaveLength(0);
  });
  it("renders all rental facts, actual extras, full addresses and safe notes", () => {
    const html = renderToStaticMarkup(
      createElement(BookingDetails, { booking }),
    );
    for (const text of [
      "09:15",
      "17:30",
      "הרצל 12, תל אביב",
      "בן יהודה 14, ירושלים",
      "Corolla",
      "2025",
      "כיסא בטיחות לילד",
      "נהג נוסף",
      "נהג לדוגמה",
      "אנגלית",
      "850",
    ])
      expect(html).toContain(text);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("never claims an email was sent unless the server confirmed it", () => {
    expect(approvalResultMessage("confirmed", true)).toEqual({
      text: "ההזמנה אושרה ומייל האישור נשלח ללקוח",
      ok: true,
    });
    for (const result of [false, null, undefined]) {
      expect(approvalResultMessage("CONFIRMED", result).ok).toBe(false);
      expect(approvalResultMessage("confirmed", result).text).not.toContain(
        "נשלח ללקוח",
      );
    }
    expect(approvalResultMessage("rejected", null).text).toBe("ההזמנה סורבה");
  });
});
