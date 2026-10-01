/**
 * Day/time helpers for driver tasks, in Israel time. A task's day comes from
 * the booking's pickup/dropoff date, its time from pickup_time/return_time.
 */

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' });
const clockFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false });

export interface ScheduledTask {
  type: 'pickup' | 'return' | 'service';
  /** Service (garage) jobs carry their own day, time and address. */
  scheduled_at?: string | null;
  scheduled_time?: string | null;
  location?: string | null;
  booking: {
    pickup_date: string;
    dropoff_date: string;
    pickup_time?: string | null;
    return_time?: string | null;
    pickup_location?: string | null;
    dropoff_location?: string | null;
  } | null;
}

/** YYYY-MM-DD in Israel, `offsetDays` from `now` (ms). */
export function israelDate(now: number, offsetDays = 0): string {
  return dayFormatter.format(new Date(now + offsetDays * 86_400_000));
}

/** HH:MM now in Israel. */
export function israelClock(now: number): string {
  return clockFormatter.format(new Date(now));
}

export function israelHour(now: number): number {
  return Number(hourFormatter.format(new Date(now)));
}

export function taskWhen(task: ScheduledTask): { day: string; time: string | null } {
  if (task.type === 'service') {
    const at = task.scheduled_at;
    return {
      day: at && !Number.isNaN(new Date(at).getTime()) ? dayFormatter.format(new Date(at)) : '',
      time: task.scheduled_time ? task.scheduled_time.slice(0, 5) : null,
    };
  }
  const date = task.type === 'pickup' ? task.booking?.pickup_date : task.booking?.dropoff_date;
  const rawTime = task.type === 'pickup' ? task.booking?.pickup_time : task.booking?.return_time;
  const day = date && !Number.isNaN(new Date(date).getTime()) ? dayFormatter.format(new Date(date)) : '';
  return { day, time: rawTime ? rawTime.slice(0, 5) : null };
}

export function taskLocation(task: ScheduledTask): string {
  if (task.type === 'service') return task.location?.trim() ?? '';
  const location = task.type === 'pickup' ? task.booking?.pickup_location : task.booking?.dropoff_location;
  return location && location !== 'לא צוין' ? location : '';
}

export function byWhen(a: ScheduledTask, b: ScheduledTask): number {
  const wa = taskWhen(a);
  const wb = taskWhen(b);
  return wa.day.localeCompare(wb.day) || (wa.time ?? '99:99').localeCompare(wb.time ?? '99:99');
}

function utcNoon(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
}

/** "היום" / "מחר" / "אתמול" / "יום שני, 5.10". */
export function dayLabel(day: string, now: number): string {
  if (!day) return '—';
  if (day === israelDate(now)) return 'היום';
  if (day === israelDate(now, 1)) return 'מחר';
  if (day === israelDate(now, -1)) return 'אתמול';
  const d = utcNoon(day);
  return `${new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'UTC' }).format(d)}, ${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}

/** "יום חמישי, 1 באוקטובר". */
export function longDate(day: string): string {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(utcNoon(day));
}

/** Short weekday letter (א׳..ש׳) and day of month, for day strips. */
export function dayParts(day: string): { weekday: string; date: number } {
  const d = utcNoon(day);
  return { weekday: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][d.getUTCDay()], date: d.getUTCDate() };
}

export function greeting(now: number): string {
  const h = israelHour(now);
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}
