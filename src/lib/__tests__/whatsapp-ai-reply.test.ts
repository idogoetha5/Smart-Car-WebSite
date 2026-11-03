import { describe, expect, it } from 'vitest';
import { validateConversationalReply, type ConversationalReplyInput } from '@/lib/whatsapp-ai-reply';

const base: ConversationalReplyInput = { reply: '', input: '', locale: 'en', known: {}, approvedFacts: [], handoffDeferred: false, bookingPhase: false };
const check = (reply: string, rest: Partial<ConversationalReplyInput> = {}) => validateConversationalReply({ ...base, ...rest, reply });

describe('output checks for natural conversational drafts', () => {
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
    expect(check('Where would you like to pick up the car?', { known: { pickupLocation: 'Tel Aviv' } })).toBeNull();
    expect(check('What dates do you need the car?', { input: 'I do not know the dates yet.' })).toBeNull();
    expect(check('What dates do you need the car?', { known: { pickupDate: '2026-12-10', returnDate: '2026-12-14' } })).toBeNull();
    expect(check('How many people will travel?', { known: { passengers: 4 } })).toBeNull();
    expect(check('What type of car do you need?', { known: { commercialVehiclePreference: 'compact' } })).toBeNull();
    expect(check('What term do you have in mind?', { known: { commercialTermMonths: 24 } })).toBeNull();
  });

  it('respects deferred handoff and active intake while allowing real missing questions', () => {
    expect(check('Would you like me to pass the enquiry to a representative?', { handoffDeferred: true })).toBeNull();
    expect(check('Would you like to start a request?', { bookingPhase: true, nextMissingField: 'customerName' })).toBeNull();
    expect(check('What name should I put on the request?', { bookingPhase: true, nextMissingField: 'customerName' })).not.toBeNull();
  });

  it('checks language, length and question count', () => {
    expect(check('שלום')).toBeNull();
    expect(check('Hello', { locale: 'he' })).toBeNull();
    expect(check('Which car? Which dates?')).toBeNull();
    expect(check('a'.repeat(651))).toBeNull();
    expect(check('אפשר להשוות בין קבוצות רכב ולוודא התאמה לדגם המסוים.', { locale: 'he' })).not.toBeNull();
  });
});
