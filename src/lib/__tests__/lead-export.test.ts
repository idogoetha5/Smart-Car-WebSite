import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }));
import { isCustomerLead } from '../lead-export';

describe('customer lead export filtering', () => {
  it.each(['דניאל דניאל', 'דניאל נרדאה', 'DANIEL NARDEA', ' Daniel   Daniel ', 'עידו גויטע', 'Ido Goetha', '\u200fעידו גויטע\u200e', 'בדיקת מייל עברית SmartCar', 'TEST — system check', ''])('excludes internal/test name %s', (name) => {
    expect(isCustomerLead(name)).toBe(false);
  });
  it.each(['Daniel Cohen', 'עידו לוי', 'סנדי ארגה', 'Avital Oliver'])('keeps customer %s', (name) => {
    expect(isCustomerLead(name)).toBe(true);
  });
});
