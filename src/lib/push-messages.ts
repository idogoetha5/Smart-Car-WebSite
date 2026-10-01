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
  type: 'pickup' | 'return' | 'service';
  /** Service jobs: garage | tire | wash | test | other. */
  serviceKind?: string | null;
  /** Service jobs: what to do ("נורית מנוע דולקת"). */
  note?: string | null;
  /** Service jobs: "טיפול תקופתי", "תקלה"… */
  reason?: string | null;
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

const customer = (t: TaskSummary) => t.customerName.trim() || (t.type === 'service' ? 'מוסך' : 'לקוח');
const isWash = (t: TaskSummary) => t.type === 'service' && t.serviceKind === 'wash';

/** Plain kind names a service title falls back to when no place name was given. */
const KIND_WORDS = new Set(['מוסך', "פנצ'רייה", 'מכון רישוי', 'שטיפה', 'אחר']);

/** What the task is, in a few words — the notification title. */
export function headline(t: TaskSummary): string {
  if (t.type === 'pickup') return `מסירת רכב ל${customer(t)}`;
  if (t.type === 'return') return `החזרת רכב מ${customer(t)}`;
  if (isWash(t)) return 'שטיפת רכב';
  const place = t.customerName.trim();
  const generic: Record<string, string> = { garage: 'נסיעה למוסך', tire: "נסיעה לפנצ'רייה", test: 'נסיעה לטסט', other: 'משימת רכב' };
  const fallback = generic[t.serviceKind ?? ''] ?? 'נסיעה למוסך';
  // A named place reads naturally after "נסיעה ל" ("נסיעה למוסך יוסי").
  return place && !KIND_WORDS.has(place) ? `נסיעה ל${place}` : fallback;
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
  const when = whenLabel(t.day, t.time, now);
  if (isWash(t)) {
    const where = [KIND_WORDS.has(t.customerName.trim()) ? '' : t.customerName.trim(), t.address].filter(Boolean).join(', ');
    return [t.vehicle, when, where, t.note].filter(Boolean).join(' · ');
  }
  if (t.type === 'service') {
    const why = [t.reason, t.note].filter(Boolean).join(': ');
    return [why, t.vehicle, when, t.address].filter(Boolean).join(' · ');
  }
  return [when, t.address, t.vehicle].filter(Boolean).join(' · ');
}

// ---- driver ------------------------------------------------------------------

export function taskAssignedMessage(t: TaskSummary, now: Date, plannedReturn?: { day: string | null; time: string | null } | null): PushMessage {
  const returnLine = plannedReturn ? `\nהחזרה: ${whenLabel(plannedReturn.day, plannedReturn.time, now)}` : '';
  return { title: headline(t), body: `${details(t, now)}${returnLine}`, url: DRIVER_URL };
}

/** Urgent task assigned to one driver. */
export function urgentAssignedMessage(t: TaskSummary, now: Date): PushMessage {
  return { title: `דחוף: ${headline(t)}`, body: details(t, now), url: DRIVER_URL, tag: 'urgent' };
}

/** Urgent task offered to every driver — the first to take it gets it. */
export function urgentOpenMessage(t: TaskSummary, now: Date): PushMessage {
  return {
    title: `דחוף ופנוי: ${headline(t)}`,
    body: `${details(t, now)}\nהראשון שלוחץ "אני לוקח" מקבל את המשימה.`,
    url: DRIVER_URL,
    tag: 'urgent-open',
  };
}

/** Managers: a driver took an open urgent task. */
export function urgentClaimedMessage(t: TaskSummary, driverName: string, now: Date): PushMessage {
  return { title: `${driverName || 'נהג'} לקח: ${headline(t)}`, body: details(t, now), url: '/driver/manage' };
}

export function taskMovedToYouMessage(t: TaskSummary, now: Date): PushMessage {
  return { title: `הועברה אליך: ${headline(t)}`, body: details(t, now), url: DRIVER_URL };
}

export function taskRemovedMessage(t: TaskSummary, now: Date): PushMessage {
  const when = whenLabel(t.day, t.time, now);
  return { title: 'משימה הועברה לנהג אחר', body: `${headline(t)}${when ? ` (${when})` : ''} כבר לא ברשימה שלך.`, url: DRIVER_URL };
}

export function taskCancelledMessage(t: TaskSummary, now: Date): PushMessage {
  const when = whenLabel(t.day, t.time, now);
  const noNeed = t.type === 'service' ? 'אין צורך לבצע אותה.' : 'אין צורך להגיע.';
  return { title: `בוטל: ${headline(t)}`, body: `${when ? `המשימה של ${when} בוטלה. ` : 'המשימה בוטלה. '}${noNeed}`, url: DRIVER_URL };
}

export function taskRescheduledMessage(t: TaskSummary, now: Date): PushMessage {
  return {
    title: `שינוי מועד: ${headline(t)}`,
    body: `המועד החדש: ${whenLabel(t.day, t.time, now)}${t.address ? ` · ${t.address}` : ''}`,
    url: DRIVER_URL,
  };
}

export function taskAddressMessage(t: TaskSummary): PushMessage {
  return { title: `כתובת חדשה: ${headline(t)}`, body: t.address || 'הכתובת הוסרה.', url: DRIVER_URL };
}

export function morningDigestMessage(name: string, tasks: TaskSummary[]): PushMessage {
  const n = (type: (t: TaskSummary) => boolean) => tasks.filter(type).length;
  const pickups = n((t) => t.type === 'pickup');
  const returns = n((t) => t.type === 'return');
  const washes = n(isWash);
  const services = tasks.length - pickups - returns - washes;
  const parts = [
    pickups ? (pickups === 1 ? 'מסירה אחת' : `${pickups} מסירות`) : '',
    returns ? (returns === 1 ? 'החזרה אחת' : `${returns} החזרות`) : '',
    services ? (services === 1 ? 'נסיעה אחת למוסך' : `${services} נסיעות למוסך`) : '',
    washes ? (washes === 1 ? 'שטיפה אחת' : `${washes} שטיפות`) : '',
  ].filter(Boolean);
  const count = tasks.length === 1 ? `היום יש לך ${parts[0]}.` : `היום יש לך ${tasks.length} משימות: ${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ' ו' : ''}${parts[parts.length - 1]}.`;
  const first = [...tasks].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))[0];
  const firstLine = first?.time ? ` הראשונה ב־${first.time}: ${headline(first)}.` : '';
  return { title: `בוקר טוב${name ? `, ${name}` : ''}`, body: `${count}${firstLine} בהצלחה!`, url: DRIVER_URL, tag: 'morning-digest' };
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
