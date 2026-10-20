import { describe, expect, it } from 'vitest';
import { brainDates, brainNormalize, brainPassengers, brainPlaces, brainSamePlace, brainSituation, brainSize, brainVehicle } from '@/lib/whatsapp-brain';

describe('the bot brain (phrase lists, no AI)', () => {
  it('is big', () => {
    const size = brainSize();
    expect(size.situationPhrases).toBeGreaterThan(3000);
    expect(size.places).toBeGreaterThan(200);
    expect(size.models).toBeGreaterThan(80);
  });

  it('normalises how people type', () => {
    expect(brainNormalize('תודההההה!!!')).toBe('תודהה');
    expect(brainNormalize('חחחחחח')).toBe('חח');
    expect(brainNormalize('נתב״ג')).toBe('נתבג');
  });

  it('recognises everyday messages', () => {
    expect(['how_are_you', 'greeting']).toContain(brainSituation('מה קורה'));
    expect(brainSituation('תודה רבה')).toBe('thanks');
    expect(brainSituation('ביי')).toBe('bye');
    expect(brainSituation('אני צריך רכב מחר מהרצליה לשבוע')).toBeNull();
  });

  it('knows places, cars and group sizes', () => {
    expect(brainPlaces('איסוף מכפר סבא')).toContain('כפר סבא');
    expect(brainVehicle('בא לי קיה פיקנטו')).toBe('ECONOMY_COMPACT');
    expect(brainPassengers('אנחנו זוג')).toBe(2);
    expect(brainSamePlace('להחזיר לאותו מקום')).toBe(true);
  });

  it('turns holidays and durations into dates', () => {
    const hanukkah = brainDates('אני צריך רכב בחנוכה', '2026-10-20');
    expect(hanukkah.pickupDate).toMatch(/^2026-12-/);
    expect(hanukkah.dropoffDate).toMatch(/^2026-12-/);
    expect(brainDates('לשבוע', '2026-10-20', '2026-11-01').dropoffDate).toBe('2026-11-08');
  });
});
