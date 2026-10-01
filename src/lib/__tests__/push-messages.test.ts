import { describe, expect, it } from 'vitest';
import {
  headline,
  inspectionSignedMessage,
  morningDigestMessage,
  taskAssignedMessage,
  taskCancelledMessage,
  taskRemovedMessage,
  taskRescheduledMessage,
  urgentAssignedMessage,
  urgentOpenMessage,
  whenLabel,
  type TaskSummary,
} from '@/lib/push-messages';

// Wednesday 1 Oct 2026, 09:00 Israel time.
const NOW = new Date('2026-10-01T06:00:00Z');
const task = (o: Partial<TaskSummary> = {}): TaskSummary => ({
  type: 'pickup',
  customerName: 'דניאל כהן',
  day: '2026-10-02',
  time: '10:00',
  address: 'הרצל 12, תל אביב',
  vehicle: 'Toyota Corolla 12-345-67',
  ...o,
});
const garage = (o: Partial<TaskSummary> = {}) =>
  task({ type: 'service', serviceKind: 'garage', customerName: 'מוסך יוסי', reason: 'תקלה', note: 'נורית מנוע דולקת', address: 'הרצל 3, חולון', ...o });
const wash = (o: Partial<TaskSummary> = {}) =>
  task({ type: 'service', serviceKind: 'wash', customerName: 'שטיפה', reason: null, address: null, time: '11:00', day: '2026-10-01', ...o });

describe('push messages', () => {
  it('says today / tomorrow / weekday in plain Hebrew', () => {
    expect(whenLabel('2026-10-01', '10:00', NOW)).toBe('היום ב־10:00');
    expect(whenLabel('2026-10-02', null, NOW)).toBe('מחר');
    expect(whenLabel('2026-10-02', '10:00', NOW, true)).toBe('למחר ב־10:00');
    expect(whenLabel('2026-10-05', '08:30', NOW)).toBe('יום שני, 5.10 ב־08:30');
  });

  it('each kind of task has its own title', () => {
    expect(headline(task())).toBe('מסירת רכב לדניאל כהן');
    expect(headline(task({ type: 'return' }))).toBe('החזרת רכב מדניאל כהן');
    expect(headline(garage())).toBe('נסיעה למוסך יוסי');
    expect(headline(garage({ customerName: 'מוסך' }))).toBe('נסיעה למוסך');
    expect(headline(garage({ serviceKind: 'tire', customerName: "פנצ'רייה" }))).toBe("נסיעה לפנצ'רייה");
    expect(headline(wash())).toBe('שטיפת רכב');
  });

  it('new task: when, where and which car', () => {
    const m = taskAssignedMessage(task(), NOW, { day: '2026-10-05', time: null });
    expect(m.title).toBe('מסירת רכב לדניאל כהן');
    expect(m.body).toBe('מחר ב־10:00 · הרצל 12, תל אביב · Toyota Corolla 12-345-67\nהחזרה: יום שני, 5.10');
    expect(m.url).toBe('/driver');
    expect(taskAssignedMessage(garage(), NOW).body).toBe('תקלה: נורית מנוע דולקת · Toyota Corolla 12-345-67 · מחר ב־10:00 · הרצל 3, חולון');
    expect(taskAssignedMessage(wash(), NOW).body).toBe('Toyota Corolla 12-345-67 · היום ב־11:00');
  });

  it('reschedule, cancel and hand-over read naturally', () => {
    expect(taskRescheduledMessage(task({ address: null }), NOW)).toMatchObject({ title: 'שינוי מועד: מסירת רכב לדניאל כהן', body: 'המועד החדש: מחר ב־10:00' });
    expect(taskCancelledMessage(task({ type: 'return' }), NOW)).toMatchObject({ title: 'בוטל: החזרת רכב מדניאל כהן', body: 'המשימה של מחר ב־10:00 בוטלה. אין צורך להגיע.' });
    expect(taskCancelledMessage(wash(), NOW).body).toBe('המשימה של היום ב־11:00 בוטלה. אין צורך לבצע אותה.');
    expect(taskRemovedMessage(task(), NOW).body).toBe('מסירת רכב לדניאל כהן (מחר ב־10:00) כבר לא ברשימה שלך.');
  });

  it('urgent: assigned says דחוף, open says the first to take it gets it', () => {
    expect(urgentAssignedMessage(wash(), NOW).title).toBe('דחוף: שטיפת רכב');
    const open = urgentOpenMessage(task({ day: '2026-10-01', time: '09:30' }), NOW);
    expect(open.title).toBe('דחוף ופנוי: מסירת רכב לדניאל כהן');
    expect(open.body).toContain('הראשון שלוחץ "אני לוקח" מקבל את המשימה.');
  });

  it('morning digest counts each kind and names the first job', () => {
    const m = morningDigestMessage('יוסי', [task({ time: '11:00' }), task({ type: 'return', customerName: 'מיכל לוי', time: '09:30' }), garage({ time: null }), wash()]);
    expect(m.title).toBe('בוקר טוב, יוסי');
    expect(m.body).toBe('היום יש לך 4 משימות: מסירה אחת, החזרה אחת, נסיעה אחת למוסך ושטיפה אחת. הראשונה ב־09:30: החזרת רכב ממיכל לוי. בהצלחה!');
    expect(morningDigestMessage('יוסי', [task()]).body).toBe('היום יש לך מסירה אחת. הראשונה ב־10:00: מסירת רכב לדניאל כהן. בהצלחה!');
  });

  it('managers hear about signed forms and new damage', () => {
    expect(
      inspectionSignedMessage({ type: 'pickup', customerName: 'דניאל כהן', vehicle: 'Toyota Corolla 12-345-67', driverName: 'יוסי', newDamageCount: 0 })
    ).toMatchObject({ title: 'נחתם טופס מסירה', body: 'דניאל כהן · Toyota Corolla 12-345-67 · נהג: יוסי' });
    expect(inspectionSignedMessage({ type: 'return', customerName: 'דניאל כהן', vehicle: 'Toyota', newDamageCount: 2 }).title).toBe('החזרה עם 2 נזקים חדשים');
  });
});
