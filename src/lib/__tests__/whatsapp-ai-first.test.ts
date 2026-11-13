import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import type { BotReading, GeminiBotContext } from '@/lib/whatsapp-rebuild-gemini';
import { termsConsent } from '@/lib/consent';

function reading(reply: string, route: BotReading['route'] = 'explore'): BotReading {
  return { route, direction: 'none', reply, fields: {}, source: 'gemini', model: 'gemini-3.5-flash-lite', groundedContext: true };
}

function chat(initial: RebuildState | null = null) {
  let state = initial;
  const create = vi.fn(async () => 'SIM-AI-FIRST');
  const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async () => null);
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, value) => { state = structuredClone(value); },
    activeBooking: async () => null, createRentalRequest: create, readTurn,
  };
  return { send: (input: string) => getRebuiltBotReply('fictional-ai-first', input, store), create, readTurn };
}

function ready(): RebuildState {
  return { version: 2, locale: 'en', phase: 'booking', step: 'rental_confirm', requestKey: 'test-request', history: [], booking: {
    pickupDate: '2027-01-10', returnDate: '2027-01-13', pickupLocation: 'Herzliya', returnLocation: 'Tel Aviv',
    vehicleNeed: 'family car', driverAgeRange: '24-plus', customerName: 'Fictional Customer', passengers: 4, luggage: 2,
  } };
}

describe('grounded AI voice with application-owned rental actions', () => {
  it.each(['We are not bringing our own child seat.', 'לא נביא כיסא בטיחות משלנו.'])('does not remove a requested seat when bringing one is negated: %s', async input => {
    const initial = ready(); initial.booking.childSeats = 1;
    const session = chat(initial);
    expect((await session.send(input)).state.booking.childSeats).toBe(1);
  });
  it.each([
    ['en', "My name is Riley Demo and I don't want to provide email. Actually, return at Ben Gurion Airport on 16 January 2027 instead; pickup stays the same. We will bring our own child seat, so don't request one from SmartCar."],
    ['he', 'קוראים לי רוני בדיקה ואין לי מייל למסור. בעצם ההחזרה תהיה בנתב״ג ב־16/1/2027, האיסוף נשאר אותו דבר. נביא כיסא בטיחות משלנו.'],
  ] as const)('retains an own-seat choice together with name and route correction: %s', async (locale, input) => {
    const initial = ready(); initial.locale = locale;
    const session = chat(initial);
    const result = await session.send(input);
    expect(result.state.booking.childSeats).toBe(0);
    expect(result.state.booking.pickupDate).toBe('2027-01-10');
    expect(result.state.booking.pickupLocation).toBe('Herzliya');
    expect(result.state.booking.returnDate).toBe('2027-01-16');
    expect(result.state.booking.returnLocation).toMatch(/Ben Gurion Airport|נתב/);
    expect(result.reply).toMatch(/removed from the draft and summary|הוסרה מהטיוטה ומהסיכום/);
    expect(result.reply).not.toMatch(/The child seat is a request only|כיסא הבטיחות הוא בקשה בלבד/);
    expect(session.create).not.toHaveBeenCalled();
  });
  it.each([
    { locale: 'en' as const, request: 'Before sending, we would like one child seat for our three-year-old. Is it guaranteed? Do not send yet.', removal: 'Actually we do not need a child seat after all, we are bringing our own. Please remove it from the request but keep the rental dates and route.', stale: 'The child seat is a request only, not a guarantee.', acknowledged: 'removed from the draft and summary' },
    { locale: 'he' as const, request: 'לפני שליחה נרצה כיסא בטיחות אחד לילד בן שלוש. זה מובטח? עוד אל תשלח.', removal: 'בעצם לא נרצה כיסא בטיחות, נביא כיסא משלנו. בבקשה להסיר אותו מהבקשה ולשמור את התאריכים והמסלול.', stale: 'כיסא הבטיחות הוא בקשה בלבד, לא הבטחה.', acknowledged: 'הוסרה מהטיוטה ומהסיכום' },
  ])('acknowledges seat removal without stale request prose or changing the saved rental ($locale)', async scenario => {
    const initial = ready();
    initial.locale = scenario.locale;
    const session = chat(initial);
    session.readTurn.mockResolvedValueOnce(null).mockResolvedValue(reading(scenario.stale, 'policy'));
    const requested = await session.send(scenario.request);
    expect(requested.state.booking.childSeats).toBe(1);
    expect(requested.reply).toMatch(/Requested child seats: 1|בקשת כיסאות בטיחות: 1/);
    const removed = await session.send(scenario.removal);
    expect(removed.reply).toContain(scenario.acknowledged);
    expect(removed.reply).not.toContain(scenario.stale);
    expect(removed.reply).not.toMatch(/Requested child seats:|בקשת כיסאות בטיחות:/);
    expect(removed.state.booking).toEqual({ ...initial.booking, childSeats: 0 });
    expect(removed.state.step).toBe('rental_confirm');
    expect(removed.state.completedRequestId).toBeUndefined();
    expect(removed.source).toBe('local');
    expect(session.readTurn.mock.calls.at(-1)![1].replyCorrection).toBe('seat_request_conflict');
    expect(session.create).not.toHaveBeenCalled();
  });

  it('answers current service driving, approval and price questions before a reference is available', async () => {
    const session = chat();
    const first = 'Plan to return at your original agreed time unless SmartCar confirms an extension beforehand. You cannot assume permission to keep driving past that deadline. Extra days may have a different rate.';
    const second = 'Yes, keep the original return time in your plans until an extension is explicitly confirmed. The additional days may cost a different rate, so the current daily price is not guaranteed.';
    session.readTurn.mockResolvedValueOnce(reading(first, 'service')).mockResolvedValueOnce(reading(second, 'service'));
    const result = await session.send('Hi, I have an existing rental due back tomorrow. I am thinking of keeping it two more days, but have not decided. Can I just keep driving, or does an extension need approval first?');
    expect(result.reply).toBe(first);
    expect(result.source).toBe('gemini');
    expect(result.state.phase).toBe('service');
    expect(result.state.handedOff).not.toBe(true);
    expect(result.escalate).not.toBe(true);
    const followup = await session.send('I do not have the reference handy yet. Just to be clear, until I get approval should I still plan to return it at the original time, and could the extra days cost a different rate?');
    expect(followup.reply).toBe(second);
    expect(followup.reply).not.toMatch(/what.*reference|send.*reference/i);
    expect(followup.source).toBe('gemini');
    expect(followup.escalate).not.toBe(true);
    expect(session.readTurn).toHaveBeenCalledTimes(2);
    const context = session.readTurn.mock.calls[1][1];
    expect(context.phase).toBe('service');
    expect(context.conversation?.hasServiceReference).toBe(false);
    expect(context.approvedFacts?.find(fact => fact.id === 'rental_extension')?.text).toContain('original agreed return deadline remains binding');
    expect(session.create).not.toHaveBeenCalled();
  });

  it('keeps an explicit service change plus reference and a later cancellation code-owned', async () => {
    const session = chat();
    session.readTurn.mockResolvedValue(reading('You may discuss options without committing to a change.', 'service'));
    await session.send('I have an existing rental and might need two extra days.');
    const changed = await session.send('My booking reference is 654321. Please extend the rental by one day. Has the extension been approved?');
    expect(changed.source).toBe('local');
    expect(changed.escalate).toBe(true);
    expect(changed.state.handoffKind).toBe('booking_change');
    expect(changed.state.serviceReference).toBe('654321');
    expect(changed.reply).toMatch(/not approved|until explicitly confirmed/i);
    const referenceContext = session.readTurn.mock.calls.at(-1)![1];
    expect(referenceContext.conversation?.hasServiceReference).toBe(true);
    expect(JSON.stringify(referenceContext)).not.toContain('654321');
    session.readTurn.mockClear();
    const recall = await session.send('So you have not approved the extension automatically, right? Please remind me which booking reference I gave you.');
    expect(recall.reply).toMatch(/not approved|until SmartCar explicitly confirms/i);
    expect(recall.reply).toContain('654321');
    expect(recall.reply).not.toMatch(/what is.*reference|please send.*reference/i);
    const hebrewRecall = await session.send('תזכיר לי איזה מספר הזמנה נתתי לך? ההארכה עדיין לא אושרה נכון?');
    expect(hebrewRecall.reply).toContain('654321');
    expect(hebrewRecall.reply).toMatch(/לא אושר/);
    const cancelled = await session.send('Actually please cancel this rental instead.');
    expect(cancelled.source).toBe('local');
    expect(cancelled.state.handoffKind).toBe('booking_change');
    expect(cancelled.reply).toMatch(/cancel|confirm/i);
    expect(session.readTurn).not.toHaveBeenCalled();
    expect(session.create).not.toHaveBeenCalled();
  });

  it('corrects a rejected compound child-seat and price answer once using only its reason and public state', async () => {
    const session = chat();
    const unsafe = 'כיסא הבטיחות מובטח. המחיר תלוי ברכב.';
    const corrected = 'אפשר לבקש כיסא בטיחות בכפוף לזמינות ולהתאמה לרכב המסוים. המחיר המדויק תלוי בתאריכים, בסוג הרכב ובתוספות המבוקשות, ונדרש אישור SmartCar להצעה.';
    session.readTurn.mockResolvedValueOnce(reading(unsafe, 'policy')).mockResolvedValueOnce({ ...reading(corrected, 'book'), fields: { pickupDate: { value: '2027-01-10', evidence: 'fabricated' } } });
    const result = await session.send('אנחנו זוג ושני ילדים עם מזוודה אחת. אפשר לבקש כיסא בטיחות, ומה קובע את המחיר?');
    expect(session.readTurn).toHaveBeenCalledTimes(2);
    const correctionContext = session.readTurn.mock.calls[1][1];
    expect(correctionContext.replyCorrection).toBe('assurance');
    expect(correctionContext.known).toMatchObject({ passengers: 4, luggage: 1 });
    expect(correctionContext.conversation).toMatchObject({ step: 'menu', completedRequest: false });
    expect(correctionContext.approvedFacts?.length).toBeGreaterThan(0);
    expect(JSON.stringify(correctionContext)).not.toContain(unsafe);
    expect(result.reply).toBe(corrected);
    expect(result.source).toBe('gemini');
    expect(result.state.phase).toBe('explore');
    expect(result.state.booking.pickupDate).toBeUndefined();
    expect(session.create).not.toHaveBeenCalled();
    expect(result.escalate).not.toBe(true);
  });

  it.each([null, reading('The child seat is guaranteed.', 'policy')])('falls back safely after a null or rejected correction without a third call: %s', async correction => {
    const session = chat();
    session.readTurn.mockResolvedValueOnce(reading('The child seat is guaranteed.', 'policy')).mockResolvedValueOnce(correction);
    const input = 'Can I request a child seat, and what determines the price?';
    const result = await session.send(input);
    const baseline = await chat().send(input);
    expect(session.readTurn).toHaveBeenCalledTimes(2);
    expect(result.reply).toBe(baseline.reply);
    expect(result.source).toBe('local');
    expect(session.create).not.toHaveBeenCalled();
    expect(result.escalate).not.toBe(true);
  });

  it.each([null, { ...reading('The child seat is guaranteed.', 'policy'), groundedContext: false }])('does not retry a missing or ungrounded initial draft: %s', async first => {
    const session = chat();
    session.readTurn.mockResolvedValue(first);
    const result = await session.send('Can I request a child seat, and what determines the price?');
    expect(session.readTurn).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('local');
    expect(session.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      locale: 'he' as const,
      input: 'בסדר, נבחר משפחתי ונתחיל בקשה. איסוף בתל אביב ב־10 בדצמבר 2026 והחזרה בנתבג ב־14 בדצמבר 2026. אני בן 35. איזה דגם משפחתי בדיוק אקבל?',
      answer: 'אפשר לציין העדפה למשפחתית, אבל הדגם המסוים תלוי בזמינות ובאישור SmartCar.',
      followup: 'חשוב לכם תא מטען גדול?',
      question: 'על איזה שם לרשום את הבקשה?',
      vehicle: 'רכב משפחתי', pickup: 'תל אביב', returned: 'נתב״ג',
    },
    {
      locale: 'en' as const,
      input: 'I choose a family car and I want to start a rental request. Pickup in Tel Aviv on 10 December 2026 and return at Ben Gurion Airport on 14 December 2026. I am 35. Which exact family model will I get?',
      answer: 'You can state a family-car preference, but the specific model depends on availability and SmartCar confirmation.',
      followup: 'Would extra luggage space help?',
      question: 'What name should I put on the request?',
      vehicle: 'family car', pickup: 'Tel Aviv', returned: 'Ben Gurion Airport',
    },
  ])('previews current intake facts and answers the exact-model question before requesting a name ($locale)', async scenario => {
    const session = chat({ version: 2, locale: scenario.locale, phase: 'explore', step: 'menu', history: [], booking: { passengers: 4, luggage: 1 } });
    session.readTurn.mockResolvedValue(reading(`${scenario.answer} ${scenario.followup}`, 'book'));
    const result = await session.send(scenario.input);
    expect(session.readTurn).toHaveBeenCalledTimes(1);
    const context = session.readTurn.mock.calls[0][1];
    expect(context.phase).toBe('booking');
    expect(context.conversation).toMatchObject({ nextMissingField: 'customerName', step: 'rental_name', completedRequest: false });
    const facts = { passengers: 4, luggage: 1, pickupDate: '2026-12-10', returnDate: '2026-12-14', pickupLocation: scenario.pickup, returnLocation: scenario.returned, vehicleNeed: scenario.vehicle, driverAgeRange: '24-plus' };
    // The airport label is normalised to נתב״ג at the end of the turn; mid-turn context may still carry the raw spelling.
    expect({ ...context.known, returnLocation: String(context.known.returnLocation).replace(/^נתבג$/u, 'נתב״ג') }).toMatchObject(facts);
    expect(context.known).not.toHaveProperty('customerName');
    expect(result.state.booking).toMatchObject(facts);
    expect(result.state.phase).toBe('booking');
    expect(result.state.step).toBe('rental_name');
    expect(result.reply).toBe(`${scenario.answer}\n\n${scenario.question}`);
    expect(result.source).toBe('gemini');
    expect(result.reply).not.toMatch(/shall we start|would you like to start|נתחיל בקשה|שנתחיל/i);
    expect(session.create).not.toHaveBeenCalled();
    expect(result.escalate).not.toBe(true);
  });

  it.each([
    'מעולה, מה שנותר הוא לאשר את שמות הנוסעים. מה שמות כל הנוסעים?',
    'מעולה, שמרנו את פרטי הנסיעה שציינת.',
  ])('keeps the next intake question application-owned when proceeding with a request: %s', async draft => {
    const session = chat({ version: 2, locale: 'he', phase: 'explore', step: 'menu', history: [], booking: { passengers: 4, luggage: 1 } });
    session.readTurn.mockResolvedValue(reading(draft, 'book'));
    const result = await session.send('בסדר, נבחר משפחתי ונתחיל בקשה. איסוף בתל אביב ב־10 בדצמבר 2026 והחזרה בנתבג ב־14 בדצמבר 2026. אני בן 35.');
    expect(result.reply).toBe('על איזה שם לרשום את הבקשה?');
    expect(result.source).toBe('local');
    expect(result.state.phase).toBe('booking');
    expect(result.state.step).toBe('rental_name');
    expect(result.state.booking).toMatchObject({ passengers: 4, luggage: 1, pickupDate: '2026-12-10', returnDate: '2026-12-14', pickupLocation: 'תל אביב', returnLocation: 'נתב״ג', vehicleNeed: 'רכב משפחתי', driverAgeRange: '24-plus' });
    expect(result.state.booking.customerName).toBeUndefined();
    expect(session.create).not.toHaveBeenCalled();
    expect(result.escalate).not.toBe(true);
  });

  it.each([
    ['We are two adults with two children and a stroller. I do not know the dates yet. What would you recommend?', 'With children and a stroller, compare a family car for extra room against a compact for easier parking. Actual stroller fit depends on the model. Is the stroller foldable?'],
    ['אנחנו זוג עם שני ילדים ועגלה. עוד מתלבטים, מה כדאי?', 'לנסיעות בעיר קטן יכול להיות נוח לחניה, ולמשפחה עם עגלה משפחתית בדרך כלל מרווחת יותר. התאמת העגלה תלויה בדגם. העגלה מתקפלת?'],
  ])('shows the unique child/stroller draft exactly without converting advice into an order: %s', async (input, draft) => {
    const session = chat();
    session.readTurn.mockResolvedValue(reading(draft));
    const result = await session.send(input);
    expect(result.reply).toBe(draft);
    expect(result.source).toBe('gemini');
    expect(result.state.booking.passengers).toBe(4);
    expect(result.state.booking.vehicleNeed).toBeUndefined();
    expect(result.state.phase).toBe('explore');
    expect(result.escalate).not.toBe(true);
    expect(session.create).not.toHaveBeenCalled();
  });

  it('uses a numerical leasing draft and supplies corrected commercial facts plus deferred handoff', async () => {
    const session = chat();
    session.readTurn.mockResolvedValue(null);
    await session.send('I am considering leasing for 36 months and 12000 km per year. No representative yet please.');
    await session.send('Actually 24 months and 15000 km per year, budget 3000 shekels monthly.');
    const draft = 'For 24 versus 36 months, compare total payments and exit conditions for the same car and 15000 km annually. Your 3000 shekel budget is a target, and any quote still needs confirmation.';
    session.readTurn.mockResolvedValue(reading(draft, 'leasing'));
    const result = await session.send('What changes between 24 and 36 months?');
    expect(result.reply).toBe(draft);
    expect(result.source).toBe('gemini');
    const context: GeminiBotContext = session.readTurn.mock.calls.at(-1)![1];
    expect(context.approvedFacts?.map(fact => fact.id)).toEqual(expect.arrayContaining(['commercial_enquiry', 'vehicle_comparison', 'insurance']));
    expect(context.conversation).toMatchObject({ interest: 'leasing', handoffDeferred: true, completedRequest: false });
    expect(context.known).toMatchObject({ commercialTermMonths: 24, commercialAnnualMileageKm: 15000, commercialBudget: 3000 });
    expect(result.escalate).not.toBe(true);
    expect(session.create).not.toHaveBeenCalled();
  });

  it('answers a side question before the canonical consent summary without losing saved rental fields', async () => {
    const initial = ready();
    const session = chat(initial);
    const draft = 'Fuel is normally returned at the same level as at pickup. The rental agreement sets the applicable fuel terms.';
    session.readTurn.mockResolvedValue(reading(draft, 'policy'));
    const result = await session.send('Before I confirm, how does returning fuel work?');
    expect(result.reply.startsWith(`${draft}\n\nHere are your request details:`)).toBe(true);
    expect(result.reply).toContain(termsConsent('en').text);
    expect(result.reply).toContain('Dates: 10/01/2027–13/01/2027');
    expect(result.reply).toContain('Name: Fictional Customer');
    expect(result.reply).toContain('https://www.smartcar.co.il/en/terms');
    expect(result.source).toBe('gemini');
    expect(result.state.booking).toEqual(initial.booking);
    expect(session.create).not.toHaveBeenCalled();
    expect(session.readTurn.mock.calls[0][1].known).not.toHaveProperty('customerName');
  });

  it('keeps the seat and price answer but leaves final consent solely to the canonical summary', async () => {
    const initial = ready();
    initial.booking.childSeats = 1;
    const session = chat(initial);
    const answer = 'The child seat can be requested subject to availability and fit for the specific car. The exact price depends on the dates, vehicle and extras, and needs SmartCar confirmation.';
    session.readTurn.mockResolvedValue(reading(`${answer} Would you like to proceed with adding the child seat?`, 'policy'));
    const result = await session.send('Can you include a child seat, and what affects the price? Please do not send the request yet.');
    expect(result.source).toBe('gemini');
    expect(result.reply.startsWith(`${answer}\n\nHere are your request details:`)).toBe(true);
    expect(result.reply).not.toContain('Would you like to proceed');
    expect(result.reply).toContain('Requested child seats: 1');
    expect(result.reply).toContain(termsConsent('en').text);
    expect(result.reply).toContain('https://www.smartcar.co.il/en/terms');
    expect(result.reply).toContain('reply “I confirm” to send the request');
    expect(result.state.step).toBe('rental_confirm');
    expect(result.state.booking).toEqual(initial.booking);
    expect(result.escalate).not.toBe(true);
    expect(session.create).not.toHaveBeenCalled();
  });

  it.each([
    'The price is 99 shekels, guaranteed.',
    'We have a car available for your dates.',
    'I have sent the request and your booking is confirmed.',
  ])('rejects a dangerous draft and preserves the same stable local response: %s', async draft => {
    const session = chat(ready());
    session.readTurn.mockResolvedValue(reading(draft, 'policy'));
    const result = await session.send('Before I confirm, what about fuel?');
    const baseline = await chat(ready()).send('Before I confirm, what about fuel?');
    expect(result.source).toBe('local');
    expect(result.reply).toBe(baseline.reply);
    expect(result.state.booking).toEqual(ready().booking);
    expect(session.create).not.toHaveBeenCalled();
    expect(result.escalate).not.toBe(true);
  });

  it('continues with saved facts when the provider returns null after a timeout', async () => {
    const initial = ready();
    initial.step = 'rental_age';
    delete initial.booking.driverAgeRange;
    const session = chat(initial);
    session.readTurn.mockResolvedValue(null);
    const result = await session.send('How does the fuel policy work?');
    expect(result.source).toBe('local');
    expect(result.state.booking).toEqual(initial.booking);
    expect(result.reply).not.toMatch(/what dates|where.*pick.up|how many passengers/i);
    expect(session.create).not.toHaveBeenCalled();
  });

  it('ignores an earlier advisory draft on final consent and creates the request once', async () => {
    const session = chat(ready());
    session.readTurn.mockResolvedValue(reading('I have sent the request and your booking is confirmed.', 'policy'));
    await session.send('Before I confirm, what about fuel?');
    session.readTurn.mockClear();
    const confirmed = await session.send('I confirm');
    expect(confirmed.state.completedRequestId).toBe('SIM-AI-FIRST');
    expect(confirmed.source).toBe('local');
    await session.send('I confirm');
    expect(session.readTurn).not.toHaveBeenCalled();
    expect(session.create).toHaveBeenCalledTimes(1);
  });
});
