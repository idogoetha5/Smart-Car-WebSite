import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  states: new Map<string, { state: Record<string, unknown>; updated_at: string }>(),
  bookings: [] as Record<string, unknown>[],
  rentalRequests: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'bookings') {
        let rows = [...mockDb.bookings];
        const query = {
          select: () => query,
          eq: (field: string, value: unknown) => {
            rows = rows.filter((row) => row[field] === value);
            return query;
          },
          in: (field: string, values: unknown[]) => {
            rows = rows.filter((row) => values.includes(row[field]));
            return query;
          },
          order: () => query,
          limit: async (count: number) => ({ data: rows.slice(0, count), error: null }),
        };
        return query;
      }

      if (table === 'whatsapp_conversation_states') {
        let operation: 'select' | 'delete' = 'select';
        let phone = '';
        const query = {
          select: () => {
            operation = 'select';
            return query;
          },
          delete: () => {
            operation = 'delete';
            return query;
          },
          eq: (field: string, value: string) => {
            if (field === 'phone') phone = value;
            if (operation === 'delete') {
              mockDb.states.delete(phone);
              return Promise.resolve({ error: null });
            }
            return query;
          },
          maybeSingle: async () => ({ data: mockDb.states.get(phone) ?? null, error: null }),
          upsert: async (row: { phone: string; state: Record<string, unknown>; updated_at: string }) => {
            mockDb.states.set(row.phone, { state: row.state, updated_at: row.updated_at });
            return { error: null };
          },
        };
        return query;
      }

      if (table === 'whatsapp_rental_requests') {
        let inserted: Record<string, unknown> | null = null;
        const query = {
          insert: (row: Record<string, unknown>) => {
            inserted = { id: mockDb.rentalRequests.length + 1, ...row };
            mockDb.rentalRequests.push(inserted);
            return query;
          },
          select: () => query,
          single: async () => ({ data: inserted, error: null }),
        };
        return query;
      }

      throw new Error(`Unexpected table in WhatsApp flow test: ${table}`);
    },
  }),
}));

import { getWhatsAppFlowReply } from '@/lib/whatsapp-flow';

const PHONE = '972501234567';

function addExistingBooking() {
  mockDb.bookings.push({
    id: 'booking-1',
    status: 'CONFIRMED',
    pickup_date: '2026-09-12',
    dropoff_date: '2026-09-16',
    pickup_location: 'Herzliya',
    dropoff_location: 'Ben Gurion Airport',
    customer_name: 'Daniel Cohen',
    customer_phone: '+972 50 123 4567',
    customer_phone_normalized: PHONE,
    vehicle: { make: 'Kia', model: 'Picanto' },
  });
}

async function completeNewRental(language: 'he' | 'en') {
  const first = await getWhatsAppFlowReply(PHONE, language === 'he' ? 'שלום' : 'Hello');
  const datesQuestion = await getWhatsAppFlowReply(PHONE, '1');
  const timesQuestion = await getWhatsAppFlowReply(PHONE, language === 'he' ? '12/09/2026 עד 16/09/2026' : '12/09/2026 to 16/09/2026');
  const locationsQuestion = await getWhatsAppFlowReply(PHONE, '09:00 | 18:00');
  const vehicleQuestion = await getWhatsAppFlowReply(PHONE, language === 'he' ? 'הרצליה | נתב״ג' : 'Tel Aviv | Ben Gurion Airport');
  const nameQuestion = await getWhatsAppFlowReply(PHONE, '3');
  const emailQuestion = await getWhatsAppFlowReply(PHONE, language === 'he' ? 'ישראל ישראלי' : 'John Smith');
  const confirmation = await getWhatsAppFlowReply(PHONE, 'agent@example.com');
  const completion = await getWhatsAppFlowReply(PHONE, language === 'he' ? 'אני מאשר' : 'I confirm');
  return { first, datesQuestion, timesQuestion, locationsQuestion, vehicleQuestion, nameQuestion, emailQuestion, confirmation, completion };
}

beforeEach(() => {
  mockDb.states.clear();
  mockDb.bookings.length = 0;
  mockDb.rentalRequests.length = 0;
});

describe('Eight required local SmartCar conversations', () => {
  it('1. Israeli customer — new rental', async () => {
    const flow = await completeNewRental('he');
    expect(flow.first.reply).toContain('ברוכים הבאים');
    expect(flow.datesQuestion.reply).toContain('מתי נוח לך לאסוף');
    expect(flow.timesQuestion.reply).toContain('באילו שעות הכי נוח לך');
    expect(flow.locationsQuestion.reply).toContain('מאיפה הכי נוח לך');
    expect(flow.vehicleQuestion.reply).toContain('איזה רכב יעשה לך');
    expect(flow.nameQuestion.reply).toContain('על שם מי');
    expect(flow.emailQuestion.reply).toContain('כתובת מייל');
    expect(flow.confirmation.reply).toContain('אני מאשר/ת');
    expect(flow.completion.reply).toContain('בקשת ההשכרה התקבלה');
    expect(flow.completion.escalate).toBe(true);
    expect(mockDb.rentalRequests).toHaveLength(1);
    expect(mockDb.rentalRequests[0]).toMatchObject({ locale: 'he', status: 'PENDING', pickup_time: '09:00', return_time: '18:00', consent_source: 'whatsapp' });
  });

  it('2. English customer — new rental', async () => {
    const flow = await completeNewRental('en');
    expect(flow.first.reply).toContain('Welcome to SmartCar');
    expect(flow.datesQuestion.reply).toContain('When would you like to pick it up');
    expect(flow.timesQuestion.reply).toContain('times work best for you');
    expect(flow.locationsQuestion.reply).toContain('most convenient for you');
    expect(flow.vehicleQuestion.reply).toContain('what kind of car');
    expect(flow.nameQuestion.reply).toContain('Who should I put');
    expect(flow.emailQuestion.reply).toContain('email address');
    expect(flow.confirmation.reply).toContain('I confirm');
    expect(flow.completion.reply).toContain('rental request has been received');
    expect(flow.completion.escalate).toBe(true);
    expect(mockDb.rentalRequests).toHaveLength(1);
    expect(mockDb.rentalRequests[0]).toMatchObject({ locale: 'en', status: 'PENDING', pickup_time: '09:00', return_time: '18:00', consent_source: 'whatsapp' });
  });

  it('3. Israeli customer — existing booking', async () => {
    addExistingBooking();
    const menu = await getWhatsAppFlowReply(PHONE, 'שלום');
    const details = await getWhatsAppFlowReply(PHONE, '1');
    expect(menu.reply).toContain('זיהינו הזמנה פעילה');
    expect(details.reply).toContain('פרטי ההזמנה שלכם');
    expect(details.reply).toContain('Kia Picanto');
  });

  it('4. English customer — existing booking', async () => {
    addExistingBooking();
    const menu = await getWhatsAppFlowReply(PHONE, 'Hello');
    const details = await getWhatsAppFlowReply(PHONE, '1');
    expect(menu.reply).toContain('We found an active booking');
    expect(details.reply).toContain('Your booking details');
    expect(details.reply).toContain('Kia Picanto');
  });

  it('5. English customer — flat tyre', async () => {
    addExistingBooking();
    const result = await getWhatsAppFlowReply(PHONE, 'I have a flat tyre');
    expect(result.escalate).toBe(true);
    expect(result.escalateReason).toContain('פנצ׳ר');
    expect(result.reply).toContain('I’m sorry you’re stuck');
    expect(result.reply).toContain('09-9509757');
  });

  it('6. Israeli customer — flat tyre', async () => {
    addExistingBooking();
    const result = await getWhatsAppFlowReply(PHONE, 'יש לי פנצ׳ר');
    expect(result.escalate).toBe(true);
    expect(result.reply).toContain('מצטערים שנתקעתם');
    expect(result.reply).toContain('09-9509757');
  });

  it('7. English customer — accident', async () => {
    addExistingBooking();
    const result = await getWhatsAppFlowReply(PHONE, 'I was in an accident');
    expect(result.escalate).toBe(true);
    expect(result.escalateReason).toContain('תאונה');
    expect(result.reply).toContain('I’m sorry this happened');
    expect(result.reply).toContain('Safety first');
  });

  it('8. Israeli customer — accident', async () => {
    addExistingBooking();
    const result = await getWhatsAppFlowReply(PHONE, 'הייתה לי תאונה');
    expect(result.escalate).toBe(true);
    expect(result.reply).toContain('מצטערים שזה קרה');
    expect(result.reply).toContain('קודם כול בטיחות');
  });

  it('accepts natural Hebrew dates, times, locations and vehicle words', async () => {
    await getWhatsAppFlowReply(PHONE, 'אני מחפש רכב לסוף השבוע');
    const returnDate = await getWhatsAppFlowReply(PHONE, '10 בדצמבר');
    expect(returnDate.reply).toContain('מתי נוח לך להחזיר');
    const times = await getWhatsAppFlowReply(PHONE, '15 בדצמבר');
    expect(times.reply).toContain('באילו שעות הכי נוח לך');
    const locations = await getWhatsAppFlowReply(PHONE, 'איסוף בתשע בבוקר והחזרה בשש בערב');
    expect(locations.reply).toContain('מאיפה הכי נוח לך');
    const vehicle = await getWhatsAppFlowReply(PHONE, 'איסוף בהרצליה והחזרה בנתבג');
    expect(vehicle.reply).toContain('איזה רכב יעשה לך');
    const name = await getWhatsAppFlowReply(PHONE, 'ג׳יפון');
    expect(name.reply).toContain('על שם מי');
  });

  it('accepts natural English dates, times, locations and vehicle words', async () => {
    await getWhatsAppFlowReply(PHONE, 'I need a car');
    const returnDate = await getWhatsAppFlowReply(PHONE, 'December tenth');
    expect(returnDate.reply).toContain('When would you like to return');
    const times = await getWhatsAppFlowReply(PHONE, 'December 16th');
    expect(times.reply).toContain('times work best for you');
    const locations = await getWhatsAppFlowReply(PHONE, 'pick up at nine am and return at six pm');
    expect(locations.reply).toContain('most convenient for you');
    const vehicle = await getWhatsAppFlowReply(PHONE, 'pick up from Tel Aviv and drop off at Ben Gurion Airport');
    expect(vehicle.reply).toContain('what kind of car');
    const name = await getWhatsAppFlowReply(PHONE, 'SUV');
    expect(name.reply).toContain('Who should I put');
  });

  it('keeps every valid fact supplied in one Hebrew message and advances directly to confirmation', async () => {
    const result = await getWhatsAppFlowReply(PHONE, 'אני צריך רכב יוקרה מ-10/09/2026 עד 14/09/2026, איסוף ב-09:00 והחזרה ב-18:00. איסוף מהרצליה והחזרה לנתבג. שמי עידו והמייל שלי ido@example.com');
    expect(result.reply).toContain('אפשר לבדוק את פרטי הבקשה');
    const state = mockDb.states.get(PHONE)?.state;
    expect(state).toMatchObject({
      pickupDate: '2026-09-10', dropoffDate: '2026-09-14', pickupTime: '09:00', returnTime: '18:00',
      pickupLocation: 'הרצליה', dropoffLocation: 'נתבג', vehiclePreference: 'LUXURY', customerEmail: 'ido@example.com',
    });
  });

  it('keeps reordered English facts and advances directly to confirmation', async () => {
    const result = await getWhatsAppFlowReply(PHONE, 'I need an SUV. My name is John Smith, john@example.com. Pick up from Tel Aviv and drop off at Ben Gurion Airport. 10/09/2026 to 14/09/2026, 9am to 6pm.');
    expect(result.reply).toContain('Please review the request below');
    expect(mockDb.states.get(PHONE)?.state).toMatchObject({ step: 'rental_confirm', vehiclePreference: 'SUV', customerName: 'John Smith', customerEmail: 'john@example.com' });
  });

  it('captures family-fit details in a mixed-language full request without asking twice', async () => {
    const result = await getWhatsAppFlowReply(PHONE, 'Need a family SUV for 5 passengers, 3 bags and 1 child seat. איסוף מהרצליה והחזרה לנתבג 10/09/2026 עד 14/09/2026, 9am עד 6pm. My name is Dana Levi, dana@example.com');
    expect(result.reply).toContain('אפשר לבדוק את פרטי הבקשה');
    expect(mockDb.states.get(PHONE)?.state).toMatchObject({
      step: 'rental_confirm', passengers: 5, luggage: 3, childSeats: 1,
      vehiclePreference: 'SUV', customerName: 'Dana Levi', customerEmail: 'dana@example.com',
    });
    expect(result.reply).toContain('צרכים: 5 נוסעים, 3 מזוודות, 1 כיסאות ילדים');
  });

  it('answers policy questions carefully without inventing a deposit, coverage or price', async () => {
    const result = await getWhatsAppFlowReply(PHONE, 'What is the deposit, insurance and fuel policy?');
    expect(result.reply).toContain('Deposit terms');
    expect(result.reply).toContain('final amount');
    expect(result.reply).not.toMatch(/guaranteed|confirmed price|no deposit/i);
    expect(result.escalate).not.toBe(true);
  });

  it('handles an angry Hebrew deposit complaint with the published answer, not a handoff', async () => {
    const result = await getWhatsAppFlowReply(PHONE, 'למה אתם רוצים ממני 3,000 פיקדון? זה הזוי');
    expect(result.escalate).not.toBe(true);
    expect(result.reply).toContain('מבין למה גובה הפיקדון מתסכל');
    expect(result.reply).toContain('₪3,000');
    expect(result.reply).not.toMatch(/אי הנוחות|אשמתך|מובטח/);
  });

  it('keeps context during a delayed-flight handoff and gives one clear action', async () => {
    await getWhatsAppFlowReply(PHONE, 'I need a car 10/09/2026 to 14/09/2026, 9am to 6pm');
    const result = await getWhatsAppFlowReply(PHONE, 'My flight is delayed and I will be late, what do I do?');
    expect(result.escalate).toBe(true);
    expect(result.reply).toContain('timing matters');
    expect(result.reply).toContain('pickup 2026-09-10');
    expect(result.reply).toContain('call SmartCar now');
  });

  it('does not ask again for captured dates after a complaint', async () => {
    await getWhatsAppFlowReply(PHONE, 'אני צריך רכב 10/09/2026 עד 14/09/2026');
    const result = await getWhatsAppFlowReply(PHONE, 'כבר כתבתי לכם את התאריכים, למה אתם שוב שואלים?');
    expect(result.escalate).not.toBe(true);
    expect(result.reply).toContain('איסוף 2026-09-10');
    expect(result.reply).toContain('באילו שעות');
  });

  it('handles a baby and late-arrival request warmly with one next question', async () => {
    const result = await getWhatsAppFlowReply(PHONE, 'אני עם תינוק ונוחת ב־1 בלילה, מה הכי מתאים?');
    expect(result.reply).toContain('עם תינוק ונוחתים מאוחר');
    expect(result.reply).toContain('מתי נוח לך לאסוף');
    expect(result.reply).not.toContain('1️⃣');
  });

  it.each(['I was charged for fuel and this is ridiculous', 'I do not accept this damage charge'])('hands an English charge complaint over without blame: %s', async (message) => {
    const result = await getWhatsAppFlowReply(PHONE, message);
    expect(result.escalate).toBe(true);
    expect(result.reply).toMatch(/frustrating|I understand/i);
    expect(result.reply).toContain('not need to repeat');
    expect(result.reply).not.toMatch(/your fault|you should have/i);
  });

  it.each([
    ['Can you collect at the airport and return in Jerusalem?', 'Send both locations and dates'],
    ['אני רוצה ליסינג לעסק', 'ליסינג עסקי'],
  ])('handles a non-rental service path with a focused next question: %s', async (message, expected) => {
    const result = await getWhatsAppFlowReply(PHONE, message);
    expect(result.reply).toContain(expected);
    expect(result.reply).not.toMatch(/confirmed booking|מובטח|סגור/);
  });

  it.each(['הצילו', 'accidnet', 'פנצאר', 'car wont start'])('escalates emergency wording before every rental step: %s', async (emergency) => {
    await getWhatsAppFlowReply(PHONE, 'אני צריך רכב');
    const result = await getWhatsAppFlowReply(PHONE, emergency);
    expect(result.escalate).toBe(true);
    expect(mockDb.states.get(PHONE)?.state).toMatchObject({ handedOff: true });
  });

  it('keeps collected details when a customer asks to change or cancel', async () => {
    await getWhatsAppFlowReply(PHONE, 'I need a car on 10/09/2026 to 14/09/2026, 9am to 6pm');
    const result = await getWhatsAppFlowReply(PHONE, 'I need to change this please');
    expect(result.escalate).toBe(true);
    expect(mockDb.states.get(PHONE)?.state).toMatchObject({ pickupDate: '2026-09-10', handedOff: true });
    expect(result.escalateReason).toContain('איסוף 2026-09-10');
    expect(result.reply).toContain('not need to repeat');
  });

  it.each([
    ['יקר לי', 'מאיפה הכי נוח לך לאסוף'],
    ['אני אחשוב על זה', 'מאיפה הכי נוח לך לאסוף'],
  ])('advises inside an active Hebrew rental without losing the next rental step: %s', async (message, expectedNext) => {
    await getWhatsAppFlowReply(PHONE, 'אני צריך רכב 10/09/2026 עד 14/09/2026, 9:00 עד 18:00');
    const result = await getWhatsAppFlowReply(PHONE, message);
    expect(result.reply).toContain(expectedNext);
    expect(result.reply).not.toMatch(/מובטח|סגור|רק היום/);
    expect(mockDb.states.get(PHONE)?.state).toMatchObject({ step: 'rental_locations', pickupDate: '2026-09-10' });
  });

  it.each([
    ['I will think about it', 'Where is most convenient for you'],
  ])('advises inside an active English rental and then asks only the missing field: %s', async (message, expectedNext) => {
    await getWhatsAppFlowReply(PHONE, 'I need a car 10/09/2026 to 14/09/2026, 9am to 6pm');
    const result = await getWhatsAppFlowReply(PHONE, message);
    expect(result.reply).toContain(expectedNext);
    expect(result.escalate).not.toBe(true);
  });

  it('records a short unrecognised vehicle phrase for review, but strips email and numbers', async () => {
    const candidates: Array<{ phrase: string; field: string }> = [];
    let state: import('@/lib/whatsapp-flow').FlowState | null = {
      step: 'rental_vehicle', locale: 'en', pickupDate: '2026-09-10', dropoffDate: '2026-09-14', pickupTime: '09:00', returnTime: '18:00', pickupLocation: 'Tel Aviv', dropoffLocation: 'Herzliya',
    };
    const store = {
      activeBooking: async () => null,
      loadState: async () => state,
      saveState: async (_phone: string, value: typeof state) => { state = value; },
      createRentalRequest: async () => null,
      recordLanguageCandidate: async (candidate: { phrase: string; field: string }) => { candidates.push(candidate); },
    };
    await getWhatsAppFlowReply(PHONE, 'luxery', store);
    await getWhatsAppFlowReply(PHONE, 'john@example.com booking 123456', store);
    expect(candidates).toEqual([{ phrase: 'luxery', field: 'vehicle' }]);
  });

  it('never creates a learning candidate from emergency wording', async () => {
    const candidates: unknown[] = [];
    const store = {
      activeBooking: async () => null, loadState: async () => null, saveState: async () => undefined,
      createRentalRequest: async () => null, recordLanguageCandidate: async (candidate: unknown) => { candidates.push(candidate); },
    };
    const result = await getWhatsAppFlowReply(PHONE, 'הצילו', store);
    expect(result.escalate).toBe(true);
    expect(candidates).toEqual([]);
  });

  it('uses an approved vehicle variant in a later conversation', async () => {
    let state: import('@/lib/whatsapp-flow').FlowState | null = {
      step: 'rental_vehicle', locale: 'en', pickupDate: '2026-09-10', dropoffDate: '2026-09-14', pickupTime: '09:00', returnTime: '18:00', pickupLocation: 'Tel Aviv', dropoffLocation: 'Herzliya',
    };
    const store = {
      activeBooking: async () => null, loadState: async () => state,
      saveState: async (_phone: string, value: typeof state) => { state = value; }, createRentalRequest: async () => null,
      resolveApprovedVariant: async (phrase: string) => phrase === 'luxery' ? 'LUXURY' : null,
    };
    const result = await getWhatsAppFlowReply(PHONE, 'luxery', store);
    expect(result.reply).toContain('Who should I put');
    expect(state).toMatchObject({ vehiclePreference: 'LUXURY', step: 'rental_name' });
  });
});
