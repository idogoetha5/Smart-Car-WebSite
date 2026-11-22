import { describe, expect, it, vi } from 'vitest';
import type { RebuildState } from '@/lib/whatsapp-rebuild';

const mutatePhoneTurn = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('@/lib/whatsapp-phone-turn', () => ({ mutatePhoneTurn }));

import { createPersistentRebuildStore } from '@/lib/whatsapp-rebuild-store';
import type { PhoneTurn } from '@/lib/whatsapp-phone-turn';

describe('WhatsApp profile name in the inbox', () => {
  it('persists the signed provider display name with the conversation state', async () => {
    const turn = { phone: '972501234567' } as PhoneTurn;
    const state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] };
    await createPersistentRebuildStore(turn, 'דניאל נרדאה').saveState(turn.phone, state);
    expect(mutatePhoneTurn).toHaveBeenCalledWith(turn, 'state', { ...state, whatsappProfileName: 'דניאל נרדאה' });
  });
});
