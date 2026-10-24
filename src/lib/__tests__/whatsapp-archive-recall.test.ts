import { describe, expect, it } from 'vitest';
import { recallArchivedCustomerQuotes } from '@/lib/whatsapp-archive-recall';
import { forgetConversationFacts, redactForgottenHistoryText } from '@/lib/whatsapp-conversation-control';

const noise = (n: number) => Array.from({ length: n }, (_, index) => ({ from: 'customer' as const, text: `Small talk ${index}` }));
describe('bounded older-customer archive retrieval', () => {
  it.each(['רק שנינו עם תיק גב אחד. רוצים רכב קטן לשלושה ימים.', 'Two adults with one backpack. We want a small car for three days.'])('does not revive a forgotten backpack from recent or old customer quotes: %s', text => {
    const state = forgetConversationFacts({ step: 'menu', locale: 'he', passengers: 2, history: [{ from: 'customer', text }] }, ['luggage']);
    const recent = redactForgottenHistoryText(state.history![0].text, 1, state.memoryForgetBefore);
    expect(recent).not.toMatch(/תיק גב|backpack/);
    expect(recent).toMatch(/שלושה ימים|three days/);
    state.history!.push(...noise(1020));
    const archive = recallArchivedCustomerQuotes('What did I want near the beginning?', state.history!, [], state.memoryForgetBefore);
    expect(archive.map(q => q.text).join(' ')).not.toMatch(/תיק גב|backpack/);
    expect(archive.map(q => q.text).join(' ')).toMatch(/שלושה ימים|three days/);
    expect(state.passengers).toBe(2);
  });

  it('keeps an unrelated charging constraint when luggage is forgotten from a mixed quote', () => {
    const text = 'I carry 3 musical instruments, and cannot use an electric car because I have no charging access.';
    const state = forgetConversationFacts({ step: 'menu', locale: 'en', conversationMemory: text, history: [{ from: 'customer', text }, ...noise(1020)] }, ['luggage']);
    expect(state.conversationMemory).toBeUndefined();
    const quotes = recallArchivedCustomerQuotes('What did I say about charging near the beginning?', state.history!, [], state.memoryForgetBefore);
    expect(quotes[0].text).toContain('no charging access');
    expect(quotes[0].text).not.toContain('3 musical instruments');
  });
  it('does not resurrect forgotten quantities written as words, but permits newly supplied facts', () => {
    const old = { from: 'customer' as const, text: 'My annual mileage is fifteen thousand kilometres.' };
    const state = forgetConversationFacts({ step: 'menu', locale: 'en', history: [old, ...noise(1020)] }, ['annualKm']);
    expect(recallArchivedCustomerQuotes('Remember my annual mileage?', state.history!, [], state.memoryForgetBefore)).toEqual([]);
    state.history!.push({ from: 'customer', text: 'My new annual mileage is 25000 km.' }, ...noise(24));
    const quotes = recallArchivedCustomerQuotes('Remember my annual mileage?', state.history!, [], state.memoryForgetBefore);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].text).toContain('25000');
  });
  it('finds a customer constraint before 1020 later messages without relying on a rolling summary', () => {
    const first = { from: 'customer' as const, text: 'We need room for 3 musical instruments in the luggage area.' };
    const history = [first, ...noise(1020)];
    expect(recallArchivedCustomerQuotes('What did I say earlier about luggage and musical instruments?', history)).toContainEqual({ position: 1, text: first.text });
  });
  it('retrieves a topic across Hebrew and English', () => {
    const quote = 'אני צריך מקום לכיסא גלגלים מתקפל, לא אישור שהרכב נגיש.';
    expect(recallArchivedCustomerQuotes('Remind me about wheelchair accessibility.', [{ from: 'customer', text: quote }, ...noise(1020)])).toContainEqual({ position: 1, text: quote });
  });
  it('keeps a later correction after the original quote in chronological order', () => {
    const history = [{ from: 'customer' as const, text: 'I prefer a manual transmission.' }, ...noise(500), { from: 'customer' as const, text: 'Correction: automatic transmission only, not manual.' }, ...noise(520)];
    const quotes = recallArchivedCustomerQuotes('What did I settle on about the transmission?', history);
    expect(quotes).toHaveLength(2);
    expect(quotes[0].text).toContain('prefer a manual');
    expect(quotes[1].text).toContain('automatic transmission only');
  });
  it('does not turn old bot claims into customer evidence', () => {
    expect(recallArchivedCustomerQuotes('What was the earlier budget?', [{ from: 'bot', text: 'Your budget is 90000.' }, ...noise(40)])).toEqual([]);
  });
  it('excludes contact data and sensitive collection steps', () => {
    const history = [
      { from: 'customer' as const, text: 'My luggage email is person@example.com' },
      { from: 'customer' as const, text: 'Luggage contact +44 7700 900123' },
      { from: 'customer' as const, text: 'Luggage for Fictional Person' },
      { from: 'customer' as const, text: 'Luggage for two', step: 'rental_confirm' },
      ...noise(40),
    ];
    expect(recallArchivedCustomerQuotes('Remember the luggage?', history, ['Fictional Person'])).toEqual([]);
  });
  it('bounds the retrieved context while scanning the retained archive', () => {
    const history = [...Array.from({ length: 1020 }, () => ({ from: 'customer' as const, text: `Luggage ${'x'.repeat(800)}` })), ...noise(24)];
    const quotes = recallArchivedCustomerQuotes('Remember the luggage?', history);
    expect(quotes).toHaveLength(8);
    expect(quotes.every(q => q.text.length <= 400)).toBe(true);
  });
  it('does not scan irrelevant historical context for a simple new detail', () => {
    expect(recallArchivedCustomerQuotes('Tomorrow morning', noise(1020))).toEqual([]);
  });
});
