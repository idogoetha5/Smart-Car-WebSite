import { describe, expect, it, vi } from 'vitest';
import { validateConversationalReply, type ConversationalReplyInput } from '@/lib/whatsapp-ai-reply';

const base: ConversationalReplyInput = { reply: '', input: '', locale: 'en', known: {}, approvedFacts: [], handoffDeferred: false, bookingPhase: false };
const check = (reply: string, rest: Partial<ConversationalReplyInput> = {}) => validateConversationalReply({ ...base, ...rest, reply });

describe('output checks for natural conversational drafts', () => {
  it.each([
    ['he', 'לאיזה תאריך מדויק תרצה לתאם את האיסוף?', 'pickupDate'],
    ['he', 'איזה תאריך נרשום להחזרה?', 'returnDate'],
    ['en', 'Which date would you like to collect the car?', 'pickupDate'],
    ['en', 'What date shall we arrange the return?', 'returnDate'],
  ] as const)('rejects natural repeated known-date wording: %s %s', (locale, reply, field) => {
    expect(check(reply, { locale, known: { [field]: '2026-12-10' } })).toBeNull();
    expect(check(reply, { locale, known: {} })).toBe(reply);
  });
  it('uses a non-identifying name-presence marker to prevent asking again', () => {
    expect(check('Could you provide your full name?', { known: { customerNameProvided: 'provided' } })).toBeNull();
  });
  it.each(['תרצו לבחור תאריכים כשתהיו מוכנים?', 'רוצה שנבדוק תאריכים?'])('rejects a soft date invitation after dates were deferred: %s', reply => {
    expect(check(reply, { locale: 'he', known: { datePreference: 'dates undecided' } })).toBeNull();
  });
  it.each(['נציג של SmartCar ישמח לחזור אליך בהקדם.', 'A SmartCar representative will follow up.', 'A representative from SmartCar will call you.'])('rejects a branded callback claim from a wording-only draft: %s', reply => {
    expect(check(reply, { locale: /[א-ת]/.test(reply) ? 'he' : 'en' })).toBeNull();
  });
  it.each([
    'A valid US driving licence held for twelve years is generally accepted for visitors, but an International Driving Permit or official translation can be helpful depending on the exact requirements.',
    'An IDP is optional; your foreign licence is accepted.',
  ])('rejects unverified country licence acceptance or weakened document requirements: %s', reply => {
    expect(check(reply, { input: 'Is my US licence definitely enough, or might I need an IDP or translation?' })).toBeNull();
  });
  it.each([
    'Bring your original valid licence; an International Driving Permit or official translation may also be required. Confirm requirements before arrival.',
    'We cannot confirm that your US licence alone is enough. An IDP may also be required.',
    'An IDP is not merely helpful; it may be required in addition to your foreign licence.',
  ])('allows conditional licence and document requirements: %s', reply => {
    expect(check(reply, { input: 'Is my US licence definitely enough, or might I need an IDP or translation?' })).toBe(reply);
  });
  it.each([
    ['נהוג לספק את היסטוריית הטיפולים המלאה, ותמיד מומלץ ואפשרי לבדוק את הרכב עצמאית.', 'he'],
    ['We provide full service history and an independent inspection is always possible.', 'en'],
  ] as const)('rejects unverified sale records and inspection assurances: %s', (reply, locale) => {
    expect(check(reply, { locale, input: 'Can I get service history and an independent inspection?' })).toBeNull();
  });
  it('allows a conditional inspection and available-records answer', () => {
    const reply = 'You can request available service records and discuss an independent inspection, subject to arrangements for the specific car.';
    expect(check(reply, { input: 'Can I get service history and an independent inspection?' })).toBe(reply);
  });
  it.each([
    ['השכרה חודשית גמישה ומאפשרת סיום או החלפה בכל שלב לפי הצורך.', 'he'],
    ['You can end or swap the rental at any time whenever you want.', 'en'],
  ] as const)('rejects unsupported unrestricted rental exit: %s', (reply, locale) => {
    expect(check(reply, { locale })).toBeNull();
  });
  it.each([
    ['Early exit and vehicle changes depend on the agreement.', 'en'],
    ['There is no guarantee you can end the rental at any time.', 'en'],
    ['אין להסיק שאפשר לסיים או להחליף בכל שלב; התנאים נקבעים בהסכם.', 'he'],
  ] as const)('allows conditional contract information: %s', (reply, locale) => {
    expect(check(reply, { locale })).toBe(reply);
  });
  it.each([
    'The child seat is a request only, not a guarantee.',
    'Your child-seat request is noted.',
    'Your request includes one child seat.',
    'כיסא הבטיחות הוא בקשה בלבד.',
    'בקשת כיסא הבטיחות נשמרה.',
  ])('rejects reintroduced child-seat requests when the saved count is explicitly zero: %s', reply => {
    const onReject = vi.fn();
    expect(check(reply, { locale: /[א-ת]/.test(reply) ? 'he' : 'en', known: { childSeats: 0 }, onReject })).toBeNull();
    expect(onReject).toHaveBeenCalledExactlyOnceWith('seat_request_conflict');
  });

  it.each([
    'Your child-seat request has been removed from the draft. Your other details are retained.',
    'Your own child seat still needs to be compatible with the specific car.',
    'בקשת כיסא הבטיחות הוסרה מהטיוטה. שאר פרטי הבקשה נשמרו.',
    'צריך לוודא שכיסא הבטיחות שלכם מתאים לרכב המסוים.',
  ])('allows honest draft-removal and own-seat compatibility advice: %s', reply => {
    expect(check(reply, { locale: /[א-ת]/.test(reply) ? 'he' : 'en', known: { childSeats: 0 } })).toBe(reply);
  });

  it.each([
    'Your booking remains active until you decide.',
    'The reservation is still valid.',
    'The booking remains in effect until you decide.',
    'Your rental has been extended.',
    'The booking is cancelled.',
    'עצם השיחה לא מבטלת את ההזמנה. ההזמנה נשארת פעילה עד שתחליט.',
    'ההזמנה שלכם עדיין בתוקף.',
    'ההזמנה הוארכה.',
  ])('rejects unverified actual booking status: %s', reply => {
    const onReject = vi.fn();
    expect(check(reply, { locale: /[א-ת]/.test(reply) ? 'he' : 'en', onReject })).toBeNull();
    expect(onReject).toHaveBeenCalledExactlyOnceWith('transaction_status');
  });

  it.each([
    'I cannot confirm that your booking is active. Discussion itself does not cancel or change a booking.',
    'Your booking is not active until its status is verified.',
    'If your booking is active, discussion alone does not cancel it.',
    'Discussion itself does not cancel or extend a booking. The original agreed return deadline remains binding until an extension is approved.',
    'לא ניתן לאשר שההזמנה פעילה. השיחה עצמה אינה מבטלת או משנה הזמנה.',
    'עצם השיחה וההתלבטות לא מבטלות הזמנה. מועד ההחזרה המקורי נשאר בתוקף עד לאישור הארכה.',
  ])('allows explicit uncertainty, negation and deadline policy without claiming actual booking status: %s', reply => {
    expect(check(reply, { locale: /[א-ת]/.test(reply) ? 'he' : 'en' })).toBe(reply);
  });

  it.each([
    ['', {}, 'empty'],
    ['A'.repeat(651), {}, 'too_long'],
    ['Which model? Which date?', {}, 'multiple_questions'],
    ['Please contact private@example.invalid.', {}, 'contact_or_link'],
    ['Your limit is 987654.', {}, 'unsupported_number'],
    ['The price is 99.', { input: 'Can the price be 99?' }, 'price_assurance'],
    ['I have sent your request.', {}, 'action_claim'],
    ['What dates do you need?', { known: { pickupDate: '2027-01-10', returnDate: '2027-01-13' } }, 'known_or_undecided_dates'],
  ] satisfies Array<[string, Partial<ConversationalReplyInput>, string]>)('reports a bounded reason without any customer or draft content: %s', (reply, rest, reason) => {
    const onReject = vi.fn();
    expect(check(reply, { input: 'My name is Private Customer, private@example.invalid, 0501234567.', ...rest, onReject })).toBeNull();
    expect(onReject).toHaveBeenCalledExactlyOnceWith(reason);
    expect(JSON.stringify(onReject.mock.calls)).not.toMatch(/Private|Customer|example|0501234567|987654|99|Which model|2027/);
  });

  it('does not emit a rejection diagnostic for an accepted draft', () => {
    const onReject = vi.fn();
    const reply = 'Compare the service record and consider an independent inspection before deciding.';
    expect(check(reply, { onReject })).toBe(reply);
    expect(onReject).not.toHaveBeenCalled();
  });

  it.each([
    'A family car may offer more room for the stroller, but fit depends on the actual model. We can compare both groups.',
    'The child seat is not guaranteed. We can include it as a request and check availability and fit before confirmation.',
    '24 months is a shorter commitment than 36 months. Compare total cost and early-exit terms before deciding.',
    'Your latest budget is 60000, and the term remains 24 months. We can keep discussing the options here.',
    'It is not a confirmed booking. The request still needs review.',
  ])('allows useful natural advice without topic blacklists: %s', reply => {
    expect(check(reply, { input: 'I need a child seat and stroller space. Compare 24 and 36 months.', known: { budget: 60000, termMonths: 24 } })).toBe(reply);
  });

  it('allows published numeric policy facts and indicative policy amounts', () => {
    expect(check('Published mileage is 200 km per day.', { approvedFacts: ['For 1–7 days, 200 km per day is included.'] })).not.toBeNull();
    expect(check('The indicative deposit is 1000, subject to the agreement.', { approvedFacts: ['The indicative deposit is 1000, subject to the agreement.'] })).not.toBeNull();
  });

  it.each([
    'Your cover is not confirmed; the applicable terms must be checked before confirmation.',
    'Your two bags may fit, but we must check the specific model before promising space.',
    'You are not covered until the applicable terms have been confirmed.',
    'I cannot guarantee that your two bags will fit. We need to check the actual model.',
    'We should check whether your two bags will fit before choosing the model.',
  ])('allows negative or conditional coverage and fit: %s', reply => {
    expect(check(reply)).toBe(reply);
  });

  it.each([
    'You are covered.', 'You qualify.', 'You can definitely rent.',
    'Your two bags will fit.', 'The stroller will fit.',
    'I recommend taking a taxi instead.', 'You could compare with Hertz.',
    'I am an AI assistant.', 'As a bot, I can help.',
    'What time would you like to pick up the car?',
    'At what hour will you return the car?',
  ])('rejects personal assurances, outside recommendations, identity and hours intake: %s', reply => {
    expect(check(reply)).toBeNull();
  });

  it('rejects equivalent Hebrew unsolicited identity and pickup-hour intake', () => {
    expect(check('אני עוזר דיגיטלי שיכול לעזור לכם.', { locale: 'he' })).toBeNull();
    expect(check('באיזו שעה תרצו לאסוף את הרכב?', { locale: 'he' })).toBeNull();
  });

  it.each([
    'The price is 99.', 'The price is 99.', 'Everything will fit.',
    'We have a car available for your dates.', 'You are fully covered.',
    'I have sent your enquiry to the team.', 'A representative will call tomorrow.',
    'Your booking is confirmed.', 'The refund is processed.',
    'Your enquiry has been forwarded.', 'We will contact you.',
    'The family car will fit your stroller.', 'The car is in stock.',
    'Email test@example.com.', 'Call 0501234567.', 'See https://example.com.',
    'The backend workflow will check the system prompt.',
  ])('rejects invented promises, actions and contact leakage: %s', reply => {
    expect(check(reply, { input: 'Can you quote 99 for my dates?' })).toBeNull();
  });

  it('rejects unsupported numbers even when the sentence sounds cautious', () => {
    expect(check('A quote might be 99 depending on terms.')).toBeNull();
  });

  it.each([
    'Please provide the names of all passengers and your email address.',
    'Send your identity number, full card number and security code.',
    'נא שלחו צילום רישיון ואת שמות כל הנוסעים.',
    'What is your email address?',
  ])('rejects model requests for private or unnecessary passenger details: %s', reply => {
    expect(check(reply, { locale: /[א-ת]/.test(reply) ? 'he' : 'en' })).toBeNull();
  });

  it.each([
    'Do not send your full card number or security code here.',
    'Please do not provide your identity number or license copy in this chat.',
    'לא לשלוח פרטי כרטיס או צילום רישיון כאן.',
  ])('allows protective reminders against sending sensitive details: %s', reply => {
    expect(check(reply, { locale: /[א-ת]/.test(reply) ? 'he' : 'en' })).toBe(reply);
  });

  it('rejects a repeated known field or undecided date prompt', () => {
    expect(check('מה התקופה או מסגרת התקציב המועדפות עליך לרכב המשפחתי?', { locale: 'he', known: { commercialInterest: 'sale', commercialBudget: 65000 } })).toBeNull();
    expect(check('What term do you have in mind?', { known: { commercialInterest: 'sale' } })).toBeNull();
    expect(check('What budget should we consider?', { known: { commercialBudget: 65000 } })).toBeNull();
    expect(check('Where would you like to pick up the car?', { known: { pickupLocation: 'Tel Aviv' } })).toBeNull();
    expect(check('What dates do you need the car?', { input: 'I do not know the dates yet.' })).toBeNull();
    expect(check('What dates do you need the car?', { known: { pickupDate: '2026-12-10', returnDate: '2026-12-14' } })).toBeNull();
    expect(check('How many people will travel?', { known: { passengers: 4 } })).toBeNull();
    expect(check('What type of car do you need?', { known: { commercialVehiclePreference: 'compact' } })).toBeNull();
    expect(check('What term do you have in mind?', { known: { commercialTermMonths: 24 } })).toBeNull();
    expect(check('מה תקופת השימוש המועדפת והקילומטראז המשוער?', { locale: 'he', known: { commercialTermMonths: 3 } })).toBeNull();
    expect(check('What is your preferred usage period?', { known: { commercialTermMonths: 3 } })).toBeNull();
  });

  it('respects deferred handoff and active intake while allowing real missing questions', () => {
    expect(check('Would you like me to pass the enquiry to a representative?', { handoffDeferred: true })).toBeNull();
    expect(check('Would you like to start a request?', { bookingPhase: true, nextMissingField: 'customerName' })).toBeNull();
    expect(check('What name should I put on the request?', { bookingPhase: true, nextMissingField: 'customerName' })).not.toBeNull();
  });

  it.each([
    'Would you like to proceed with setting up your family car request for December?',
    'Shall we continue with the booking?',
    'Would you like to set up the request?',
    'תרצו להתקדם עם בקשת ההזמנה?',
    'האם לפתוח בקשה?',
    'נתקדם לפתיחת בקשה?',
  ])('rejects renewed workflow consent during active booking: %s', reply => {
    expect(check(reply, { locale: /[א-ת]/.test(reply) ? 'he' : 'en', bookingPhase: true, nextMissingField: 'customerName' })).toBeNull();
  });

  it('allows a topical follow-up question during active booking', () => {
    const reply = 'Is there any insurance part I can explain?';
    expect(check(reply, { bookingPhase: true, nextMissingField: 'customerName' })).toBe(reply);
  });

  it('checks language, length and question count', () => {
    expect(check('שלום')).toBeNull();
    expect(check('Hello', { locale: 'he' })).toBeNull();
    expect(check('Which car? Which dates?')).toBeNull();
    expect(check('a'.repeat(651))).toBeNull();
    expect(check('אפשר להשוות בין קבוצות רכב ולוודא התאמה לדגם המסוים.', { locale: 'he' })).not.toBeNull();
  });
});
