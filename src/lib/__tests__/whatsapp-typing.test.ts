import { describe, expect, it } from 'vitest';
import { closeEnough, fromTransliteration, fromWrongHebrewLayout, fromWrongLayout, keyboardDistance, repairCustomerText } from '@/lib/whatsapp-typing';

describe('phone typing repairs', () => {
  it('reads Hebrew typed with the keyboard left in English', () => {
    expect(fromWrongLayout('mrhl rfc')).toBe('צריך רכב');
    expect(fromWrongLayout('vhh')).toBe('היי');
    expect(fromWrongLayout('I need a car')).toBe(null);
    expect(fromWrongLayout('John Smith')).toBe(null);
  });

  it('reads English typed with the keyboard left in Hebrew', () => {
    expect(fromWrongHebrewLayout('ןמקקג ש באםרק')).toBe(null);
    expect(fromWrongHebrewLayout('רכב')).toBe(null);
  });

  it('reads Hebrew written in English letters', () => {
    expect(fromTransliteration('ani tzarich rechev machar')).toBe('אני צריך רכב מחר');
    expect(fromTransliteration('ma kore achi')).toBe('מה קורה אחי');
    expect(fromTransliteration('I need a car tomorrow')).toBe(null);
    expect(fromTransliteration('Ramat Yam 122')).toBe(null);
  });

  it('treats neighbouring keys and sound-alike letters as small slips', () => {
    expect(keyboardDistance('רכו', 'רכב')).toBe(0.75);
    expect(closeEnough('מיכל', 'מנהל')).toBe(false);
    expect(closeEnough('תאוטה', 'תאונה')).toBe(true);
    expect(closeEnough('צריכ', 'צריך')).toBe(true);
    expect(closeEnough('accidnet', 'accident')).toBe(true);
    expect(closeEnough('שלום', 'תאונה')).toBe(false);
  });

  it('leaves ordinary messages alone', () => {
    expect(repairCustomerText('אני צריך רכב')).toBe('אני צריך רכב');
    expect(repairCustomerText('Hello, I need a car')).toBe('Hello, I need a car');
    expect(repairCustomerText('ישראל ישראלי')).toBe('ישראל ישראלי');
  });
});
