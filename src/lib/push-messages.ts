/**
 * Wording of the phone notifications (Web Push) the driver and manager apps
 * send. Pure functions — no I/O — so the texts are easy to review and test.
 */

export interface PushMessage {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  /** Same tag replaces an older notification instead of stacking. */
  tag?: string;
}

export interface TaskSummary {
  type: 'pickup' | 'return';
  customerName: string;
  /** YYYY-MM-DD, Israel. */
  day: string | null;
  /** HH:MM, or null when no time was set. */
  time: string | null;
  address: string | null;
  vehicle?: string | null;
}

const DRIVER_URL = '/driver';
const MANAGER_URL = '/driver/manage';

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' });
const weekdayFormatter = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long' });

function israelDay(now: Date, offsetDays = 0): string {
  return dayFormatter.format(new Date(now.getTime() + offsetDays * 86_400_000));
}

const typeWord = (type: TaskSummary['type']) => (type === 'pickup' ? 'מסירה' : 'החזרה');
const customer = (t: TaskSummary) => t.customerName.trim() || 'לקוח';

/** "המסירה לדניאל כהן" / "ההחזרה של דניאל כהן". */
function taskPhrase(t: TaskSummary): string {
  return t.type === 'pickup' ? `המסירה ל${customer(t)}` : `ההחזרה של ${customer(t)}`;
}

/**
 * When, in plain Hebrew. `withLamed` gives the "to" form used after
 * "נקבעה" (להיום / למחר / ליום ראשון).
 */
export function whenLabel(day: string | null, time: string | null, now: Date, withLamed = false): string {
  const at = time ? ` ב־${time}` : '';
  if (!day) return time ? `ב־${time}` : '';
  if (day === israelDay(now)) return `${withLamed ? 'להיום' : 'היום'}${at}`;
  if (day === israelDay(now, 1)) return `${withLamed ? 'למחר' : 'מחר'}${at}`;
  const [y, m, d] = day.split('-').map(Number);
  // Noon UTC keeps the weekday right in Israel whatever the offset.
  const weekday = y && m && d ? weekdayFormatter.format(new Date(Date.UTC(y, m - 1, d, 12))) : '';
  const date = d && m ? `${d}.${m}` : day;
  return `${withLamed ? 'ל' : ''}${weekday ? `${weekday}, ` : ''}${date}${at}`;
}

function details(t: TaskSummary, now: Date): string {
  return [customer(t), whenLabel(t.day, t.time, now), t.address].filter(Boolean).join(' · ');
}

// ---- driver ------------------------------------------------------------------

export function taskAssignedMessage(t: TaskSummary, now: Date, plannedReturn?: { day: string | null; time: string | null } | null): PushMessage {
  const returnLine = plannedReturn ? `\nהחזרה: ${whenLabel(plannedReturn.day, plannedReturn.time, now)}` : '';
  return {
    title: `משימה חדשה — ${typeWord(t.type)}`,
    body: `${details(t, now)}${returnLine}`,
    url: DRIVER_URL,
  };
}

export function taskMovedToYouMessage(t: TaskSummary, now: Date): PushMessage {
  return { title: `משימה הועברה אליך — ${typeWord(t.type)}`, body: details(t, now), url: DRIVER_URL };
}

export function taskRemovedMessage(t: TaskSummary, now: Date): PushMessage {
  const when = whenLabel(t.day, t.time, now);
  return {
    title: 'משימה הועברה לנהג אחר',
    body: `${taskPhrase(t)}${when ? ` (${when})` : ''} כבר לא ברשימה שלך.`,
    url: DRIVER_URL,
  };
}

export function taskCancelledMessage(t: TaskSummary, now: Date): PushMessage {
  const when = whenLabel(t.day, t.time, now);
  return {
    title: 'משימה בוטלה',
    body: `${taskPhrase(t)}${when ? ` (${when})` : ''} בוטלה. אין צורך להגיע.`,
    url: DRIVER_URL,
  };
}

export function taskRescheduledMessage(t: TaskSummary, now: Date): PushMessage {
  const when = whenLabel(t.day, t.time, now, true);
  return {
    title: `שינוי מועד — ${typeWord(t.type)}`,
    body: `${taskPhrase(t)} נקבעה ${when}.${t.address ? ` הכתובת: ${t.address}.` : ''}`,
    url: DRIVER_URL,
  };
}

export function taskAddressMessage(t: TaskSummary): PushMessage {
  return {
    title: 'עודכנה כתובת',
    body: t.address ? `${taskPhrase(t)}: ${t.address}` : `הכתובת של ${taskPhrase(t)} הוסרה.`,
    url: DRIVER_URL,
  };
}

export function morningDigestMessage(name: string, tasks: TaskSummary[]): PushMessage {
  const pickups = tasks.filter((t) => t.type === 'pickup').length;
  const returns = tasks.length - pickups;
  const parts = [
    pickups ? (pickups === 1 ? 'מסירה אחת' : `${pickups} מסירות`) : '',
    returns ? (returns === 1 ? 'החזרה אחת' : `${returns} החזרות`) : '',
  ].filter(Boolean);
  const count = tasks.length === 1 ? `היום יש לך ${parts[0]}.` : `היום יש לך ${tasks.length} משימות: ${parts.join(' ו')}.`;
  const first = [...tasks].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))[0];
  const firstLine = first?.time ? ` הראשונה ב־${first.time} — ${customer(first)}.` : '';
  return {
    title: `בוקר טוב${name ? `, ${name}` : ''}`,
    body: `${count}${firstLine} בהצלחה!`,
    url: DRIVER_URL,
    tag: 'morning-digest',
  };
}

// ---- managers ----------------------------------------------------------------

export function inspectionSignedMessage(args: {
  type: 'pickup' | 'return';
  customerName: string;
  vehicle: string;
  driverName?: string | null;
  newDamageCount: number;
}): PushMessage {
  const who = args.customerName.trim() || 'לקוח';
  const line = [who, args.vehicle, args.driverName ? `נהג: ${args.driverName}` : ''].filter(Boolean).join(' · ');
  if (args.type === 'return' && args.newDamageCount > 0) {
    return {
      title: args.newDamageCount === 1 ? 'החזרה עם נזק חדש' : `החזרה עם ${args.newDamageCount} נזקים חדשים`,
      body: `${line}\nהטופס החתום והתמונות מחכים בדף המנהלים.`,
      url: MANAGER_URL,
    };
  }
  return {
    title: args.type === 'pickup' ? 'נחתם טופס מסירה' : 'נחתם טופס החזרה',
    body: args.type === 'return' ? `${line} · ללא נזקים חדשים` : line,
    url: MANAGER_URL,
  };
}

export function testMessage(isManager: boolean): PushMessage {
  return {
    title: 'ההתראות פועלות ✓',
    body: isManager
      ? 'מעכשיו תקבלו כאן הודעה על כל טופס שנחתם ועל החזרות עם נזקים חדשים.'
      : 'מעכשיו תקבלו כאן הודעה על כל משימה חדשה ועל כל שינוי במשימות שלכם.',
    url: isManager ? MANAGER_URL : DRIVER_URL,
    tag: 'test',
  };
}
