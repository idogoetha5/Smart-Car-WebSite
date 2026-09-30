import { describe, expect, it } from 'vitest';
import {
  inspectionSignedMessage,
  morningDigestMessage,
  taskAssignedMessage,
  taskCancelledMessage,
  taskRemovedMessage,
  taskRescheduledMessage,
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
  ...o,
});

describe('push messages', () => {
  it('says today / tomorrow / weekday in plain Hebrew', () => {
    expect(whenLabel('2026-10-01', '10:00', NOW)).toBe('היום ב־10:00');
    expect(whenLabel('2026-10-02', null, NOW)).toBe('מחר');
    expect(whenLabel('2026-10-02', '10:00', NOW, true)).toBe('למחר ב־10:00');
    expect(whenLabel('2026-10-05', '08:30', NOW)).toBe('יום שני, 5.10 ב־08:30');
  });

  it('new task: type in the title, customer + when + address in the body', () => {
    const m = taskAssignedMessage(task(), NOW, { day: '2026-10-05', time: null });
    expect(m.title).toBe('משימה חדשה — מסירה');
    expect(m.body).toBe('דניאל כהן · מחר ב־10:00 · הרצל 12, תל אביב\nהחזרה: יום שני, 5.10');
    expect(m.url).toBe('/driver');
  });

  it('reschedule, cancel and hand-over read naturally', () => {
    expect(taskRescheduledMessage(task({ address: null }), NOW).body).toBe('המסירה לדניאל כהן נקבעה למחר ב־10:00.');
    expect(taskCancelledMessage(task({ type: 'return' }), NOW).body).toBe('ההחזרה של דניאל כהן (מחר ב־10:00) בוטלה. אין צורך להגיע.');
    expect(taskRemovedMessage(task(), NOW).body).toBe('המסירה לדניאל כהן (מחר ב־10:00) כבר לא ברשימה שלך.');
  });

  it('morning digest counts the day and names the first job', () => {
    const m = morningDigestMessage('יוסי', [task({ time: '11:00' }), task({ type: 'return', customerName: 'מיכל לוי', time: '09:30' }), task({ time: null })]);
    expect(m.title).toBe('בוקר טוב, יוסי');
    expect(m.body).toBe('היום יש לך 3 משימות: 2 מסירות והחזרה אחת. הראשונה ב־09:30 — מיכל לוי. בהצלחה!');
    expect(morningDigestMessage('יוסי', [task()]).body).toBe('היום יש לך מסירה אחת. הראשונה ב־10:00 — דניאל כהן. בהצלחה!');
  });

  it('managers hear about signed forms and new damage', () => {
    expect(inspectionSignedMessage({ type: 'pickup', customerName: 'דניאל כהן', vehicle: 'Toyota Corolla 12-345-67', driverName: 'יוסי', newDamageCount: 0 })).toMatchObject({
      title: 'נחתם טופס מסירה',
      body: 'דניאל כהן · Toyota Corolla 12-345-67 · נהג: יוסי',
    });
    expect(inspectionSignedMessage({ type: 'return', customerName: 'דניאל כהן', vehicle: 'Toyota', newDamageCount: 2 }).title).toBe('החזרה עם 2 נזקים חדשים');
    expect(inspectionSignedMessage({ type: 'return', customerName: 'דניאל כהן', vehicle: 'Toyota', newDamageCount: 0 }).body).toBe('דניאל כהן · Toyota · ללא נזקים חדשים');
  });
});
