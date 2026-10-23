import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import training from '@/lib/whatsapp-academy-bank.json';
import { retrieveAcademyExamples, renderAcademyExamples } from '@/lib/whatsapp-academy-retrieval';
import { getConversationAcademy } from '@/lib/whatsapp-service-academy';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

type Item = typeof training[number];
const heldout = JSON.parse(readFileSync(new URL('../../../scripts/whatsapp-eval/academy-heldout.json', import.meta.url), 'utf8')) as Item[];
const all = [...training, ...heldout];

describe('academy teaching bank and strict connection gates (not model-quality scores)', () => {
  it('keeps 3072 synthetic teaching variants separate from 1024 profile-held-out variants', () => {
    expect(training).toHaveLength(3072);
    expect(heldout).toHaveLength(1024);
    expect(new Set(all.map(item => item.id)).size).toBe(4096);
    expect(training.every(item => item.profile < 12)).toBe(true);
    expect(heldout.every(item => item.profile >= 12)).toBe(true);
    expect(new Set(all.map(item => item.topic)).size).toBe(16);
  });
  it('checks all 4096 variants for bounded training-only retrieval, language and topic isolation', () => {
    const ids = new Set(training.map(item => item.id));
    for (const item of all) {
      const locale = item.locale as 'he' | 'en';
      const found = retrieveAcademyExamples(item.message, locale, [item.topic], item.known);
      expect(found.length, item.id).toBeLessThanOrEqual(2);
      expect(found.every(example => ids.has(example.id) && example.locale === locale && example.topic === item.topic), item.id).toBe(true);
      expect(renderAcademyExamples(found).length, item.id).toBeLessThan(5000);
      if (found.length) expect(renderAcademyExamples(found)).toContain('FICTIONAL');
    }
  });
  it('gives every domain a substantial relevant lesson and does not dump the bank into prompts', () => {
    for (const topic of new Set(all.map(item => item.topic))) {
      const item = training.find(row => row.topic === topic)!;
      const text = getConversationAcademy(item.message, '', item.locale as 'he' | 'en');
      expect(text).toContain('CONVERSATION ACADEMY');
      expect(text.length).toBeLessThan(22000);
      expect(text).not.toContain('p12-');
    }
  });
  it('keeps the model voice and prevents category inference across 2304 advisory variants', async () => {
    // Model understanding is deliberately mocked. This proves the application
    // honours an advisory act; it DOES NOT prove Gemini understood these inputs.
    const advisory = new Set(['hebrew', 'visitors', 'family', 'budget', 'choice', 'long-term', 'continuity', 'ambiguity', 'accessible-service']);
    let checked = 0;
    for (const item of all.filter(row => advisory.has(row.topic))) {
      let state: FlowState | null = { step: 'rental_vehicle', locale: item.locale as 'he' | 'en', pickupDate: item.known.pickupDate, dropoffDate: item.known.dropoffDate, pickupLocation: item.known.pickupLocation, dropoffLocation: item.known.dropoffLocation };
      const reply = item.locale === 'he' ? 'אפשר להתאים את הבחירה לצורך שתיארת, בלי להתקדם כרגע להזמנה.' : 'We can match the choice to your needs without starting a booking now.';
      const quotes = vi.fn(async () => []);
      const store: WhatsAppFlowStore = {
        engine: 'ai', isSimulation: true, activeBooking: async () => null,
        loadState: async () => state, saveState: async (_phone, next) => { state = next; },
        createRentalRequest: async () => { throw new Error('Advisory messages cannot submit'); }, getRentalQuotes: quotes,
        interpretMessage: async () => ({ purpose: 'advice', intent: 'rental', source: 'gemini', reply, asks: 'nothing',
          vehiclePreference: 'SUV', vehicleEvidence: item.message, pickupLocation: '', pickupEvidence: '', dropoffLocation: '', dropoffEvidence: '', pickupDate: '', dropoffDate: '', pickupTime: '', returnTime: '', passengers: 0, acknowledgement: '' }),
      };
      const result = await getWhatsAppFlowReply(`academy-${item.id}`, item.message, store);
      expect(result.reply, item.id).toBe(reply);
      expect((state as FlowState | null)?.vehiclePreference, item.id).toBeUndefined();
      expect(quotes, item.id).not.toHaveBeenCalled();
      checked++;
    }
    expect(checked).toBe(2304);
  }, 120000);
});
