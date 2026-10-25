"use client";

import { BOOKING_EXTRAS, type AdminBooking } from "@/lib/admin-bookings";
import { numericOrderReference } from "@/lib/order-reference";
import {
  formatLocationForDriver,
  navigationQueryFor,
} from "@/lib/location-display";
import BookingStatusBadge from "@/components/ui/BookingStatusBadge";

function date(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "לא צוין";
  return new Date(value).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
  });
}

function Detail({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value?: string | number;
  ltr?: boolean;
}) {
  return (
    <div className="min-w-0 py-2">
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd
        dir={ltr ? "ltr" : "auto"}
        className="mt-1 whitespace-pre-wrap break-words text-right text-base font-bold text-[#0D2B2B] [overflow-wrap:anywhere]"
      >
        {value == null || value === "" ? "לא צוין" : value}
      </dd>
    </div>
  );
}
export default function BookingDetails({
  booking: b,
}: {
  booking: AdminBooking;
}) {
  const pickup = [
    ...new Set(
      [
        formatLocationForDriver(b.pickup_location),
        b.pickup_address || navigationQueryFor(b.pickup_location),
      ].filter(Boolean),
    ),
  ].join("\n");
  const dropoff = [
    ...new Set(
      [
        formatLocationForDriver(b.dropoff_location),
        b.return_address || navigationQueryFor(b.dropoff_location),
      ].filter(Boolean),
    ),
  ].join("\n");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-black text-[#2D5F5F]">
          הזמנה <bdi>#{numericOrderReference(b.id)}</bdi>
        </span>
        <BookingStatusBadge status={b.status} variant="admin" size="md" />
      </div>
      {b.match_status === "MANUAL_MATCH_REQUIRED" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
          נדרשת התאמה ידנית של רכב לפני אישור ההזמנה.
        </p>
      )}
      <section>
        <h3 className="border-b border-slate-100 pb-2 font-black text-[#2D5F5F]">
          פרטי הלקוח
        </h3>
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Detail label="שם מלא" value={b.customer_name} />
          <Detail label="טלפון" value={b.customer_phone} ltr />
          <Detail label="אימייל" value={b.customer_email} ltr />
          <Detail label="גיל הנהג" value={b.driver_age_range === "21-23" ? "21–23" : b.driver_age_range === "24-plus" ? "24+" : undefined} />
          <Detail
            label="שפת ההזמנה"
            value={
              b.consent_locale === "en"
                ? "אנגלית"
                : b.consent_locale === "he"
                  ? "עברית"
                  : undefined
            }
          />
        </dl>
      </section>
      <section>
        <h3 className="border-b border-slate-100 pb-2 font-black text-[#2D5F5F]">
          רכב ותקופת השכרה
        </h3>
        <dl>
          <Detail
            label="רכב"
            value={[b.vehicle?.make, b.vehicle?.model, b.vehicle?.year]
              .filter(Boolean)
              .join(" ")}
          />
          <Detail
            label="תאריך ושעת איסוף"
            value={`${date(b.pickup_date)} · ${b.pickup_time || "שעה לא צוינה"}`}
          />
          <Detail label="מקום וכתובת האיסוף" value={pickup} />
          <Detail
            label="תאריך ושעת החזרה"
            value={`${date(b.dropoff_date)} · ${b.return_time || "שעה לא צוינה"}`}
          />
          <Detail label="מקום וכתובת ההחזרה" value={dropoff} />
        </dl>
      </section>
      <section>
        <h3 className="border-b border-slate-100 pb-2 font-black text-[#2D5F5F]">
          תוספות ומחיר
        </h3>
        {b.extras?.length ? (
          <ul className="mt-3 space-y-2">
            {b.extras.map((extra, i) => (
              <li
                key={`${extra}-${i}`}
                className="rounded-xl bg-[#EAF4F4] px-3 py-2 text-sm font-bold text-[#1F5A56]"
              >
                {BOOKING_EXTRAS[extra] ?? extra}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-slate-500">לא נבחרו תוספות</p>
        )}
        {b.additional_driver_name && (
          <dl>
            <Detail label="שם הנהג הנוסף" value={b.additional_driver_name} />
          </dl>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-4">
          <Detail label="ימי השכרה" value={b.total_days} />
          <Detail
            label="מחיר ליום"
            value={
              b.price_per_day == null
                ? undefined
                : `₪${Number(b.price_per_day).toLocaleString("he-IL")}`
            }
          />
          <Detail
            label="סכום ההזמנה"
            value={
              b.total_price == null
                ? undefined
                : `₪${Number(b.total_price).toLocaleString("he-IL")}`
            }
          />
        </dl>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          סכום ההזמנה אינו מעיד שהתשלום נגבה.
        </p>
      </section>
      {(b.notes || b.special_requests) && (
        <section>
          <h3 className="font-black text-[#2D5F5F]">הערות ובקשות</h3>
          <p
            dir="auto"
            className="mt-2 whitespace-pre-wrap break-words text-base leading-7"
          >
            {[b.notes, b.special_requests].filter(Boolean).join("\n")}
          </p>
        </section>
      )}
      <Detail label="התקבלה בתאריך" value={date(b.created_at)} />
    </div>
  );
}
