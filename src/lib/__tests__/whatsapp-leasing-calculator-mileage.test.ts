import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import { annualMileageMentions } from '@/lib/whatsapp-commercial-memory';
import { validateConversationalReply } from '@/lib/whatsapp-ai-reply';

const prefill = 'היי! אני מעוניין בליסינג על 2024 Toyota Corolla\n\nפרטי הבקשה:\n🚗 רכב: 2024 Toyota Corolla\n📅 משך חוזה: 36 חודשים\n📍 קילומטרז׳: 12,000 ק״מ לשנה\n💰 מחיר חודשי משוער: ₪2,400\n\nאשמח לקבל פרטים נוספים, תודה!';
describe('calculator annual mileage cannot turn into another approved policy number', () => {
  it.each([['לשלושת אלפי קילומטרים בשנה', 3000], ['12,000 ק״מ לשנה', 12000], ['twelve thousand kilometres a year', 12000], ['3000 km/year', 3000]] as const)('reads bounded annual units: %s', (text, value) => {
    expect(annualMileageMentions(text)).toEqual([value]);
  });
  it('does not treat monthly or daily allowances as annual mileage', () => {
    expect(annualMileageMentions('220 km/day and 2500 km per 30 days.')).toEqual([]);
  });
  it('retains customer-requested mileage comparisons, not unrelated term comparisons', () => {
    const base = { locale: 'en' as const, approvedFacts: [], handoffDeferred: false, bookingPhase: false, known: { commercialAnnualMileageKm: 12000 } };
    expect(validateConversationalReply({ ...base, input: 'Compare 12000 km/year versus 15000 km/year.', reply: 'Compare 12000 km/year and 15000 km/year on the same vehicle.' })).not.toBeNull();
    expect(validateConversationalReply({ ...base, input: 'Compare 24 versus 36 months, with 12000 km/year.', reply: 'Your plan has 3000 km/year; compare the two terms.' })).toBeNull();
  });
  it('corrects the exact live Hebrew draft and keeps calculator price separate from budget', async () => {
    let state: RebuildState | null = null;
    const corrected = 'לפי הפרטים שמסרת, מדובר בבירור ל־36 חודשים ו־12,000 ק״מ לשנה. מחיר המחשבון הוא הערכה בלבד; המחיר והתנאים הסופיים ייקבעו בהצעה ובחוזה.';
    const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async (_input, context) => ({ route: 'leasing', direction: 'none', fields: {}, source: 'gemini', model: 'test', groundedContext: true, reply: context.replyCorrection ? corrected : 'נשמח לבדוק ליסינג פרטי על טויוטה קורולה לשלושת אלפי קילומטרים בשנה למשך 36 חודשים. האם תרצה לבדוק את ההבדלים לעומת תקופה קצרה יותר?' }));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: async () => { throw new Error('no rental'); }, readTurn };
    const result = await getRebuiltBotReply('fictional-calculator', prefill, store);
    expect(result.state.commercial).toMatchObject({ termMonths: 36, annualMileageKm: 12000 });
    expect(result.state.commercial?.budget).toBeUndefined();
    expect(result.reply).toBe(corrected);
    expect(result.source).toBe('gemini');
    expect(result.escalate).toBe(false);
    expect(readTurn.mock.calls[1]?.[1].replyCorrection).toBe('mileage_conflict');
  });
});
