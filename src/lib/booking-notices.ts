// Notices shown while a customer picks dates and locations (home search and
// the booking form). They only inform — nothing here changes the estimate.

export const AIRPORT_SURCHARGE_ILS = 150;

/** True when a YYYY-MM-DD date falls on Saturday (Shabbat). */
export function isShabbat(date: string | undefined | null): boolean {
  if (!date) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay() === 6;
}

export type BookingNoticeInput = {
  pickupDate?: string;
  returnDate?: string;
  pickupLocation?: string;
  returnLocation?: string;
  isHe: boolean;
};

export function getBookingNotices({ pickupDate, returnDate, pickupLocation, returnLocation, isHe }: BookingNoticeInput): string[] {
  const notices: string[] = [];

  const pickupSat = isShabbat(pickupDate);
  const returnSat = isShabbat(returnDate);
  if (pickupSat || returnSat) {
    const which = pickupSat && returnSat
      ? (isHe ? 'תאריך האיסוף ותאריך ההחזרה חלים' : 'Your pickup and return dates fall')
      : pickupSat
        ? (isHe ? 'תאריך האיסוף חל' : 'Your pickup date falls')
        : (isHe ? 'תאריך ההחזרה חל' : 'Your return date falls');
    notices.push(isHe
      ? `שימו לב: ${which} בשבת. איסוף או החזרה בשבת עשויים להיות כרוכים בתוספת תשלום ובתיאום מראש עם הנציג.`
      : `Please note: ${which} on Shabbat (Saturday). Pickup or return on Shabbat may involve an extra charge and must be arranged in advance with a representative.`);
  }

  if (pickupLocation === 'airport' || returnLocation === 'airport') {
    notices.push(isHe
      ? `שימו לב: איסוף או החזרה בנתב״ג כרוכים בתוספת של ${AIRPORT_SURCHARGE_ILS}\u00A0₪, שאינה כלולה במחיר המשוער.`
      : `Please note: pickup or return at Ben Gurion Airport carries a ₪${AIRPORT_SURCHARGE_ILS} surcharge, not included in the estimate.`);
  }

  return notices;
}
