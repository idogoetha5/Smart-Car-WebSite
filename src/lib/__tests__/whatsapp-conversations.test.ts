import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: mocks.client }));
import { isConversationSilenced } from '@/lib/whatsapp-conversations';

describe('human takeover ownership check', () => {
  beforeEach(() => vi.useRealTimers());
  function query(data: unknown[] | null, error: unknown = null) {
    const chain = { select: vi.fn(), eq: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn() };
    for (const key of ['select', 'eq', 'or', 'order'] as const) chain[key].mockReturnValue(chain);
    chain.limit.mockResolvedValue({ data, error });
    mocks.client.mockReturnValue({ from: () => chain });
    return chain;
  }
  it('filters takeover rows before limiting instead of inspecting only the last 20 messages', async () => {
    const chain = query([{ source: 'human_reply', created_at: new Date().toISOString(), escalated_at: null }]);
    expect(await isConversationSilenced('972501234567')).toBe(true);
    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('and(source.eq.human_reply,created_at.gt.'));
    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('escalated_at.gt.'));
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(chain.or.mock.invocationCallOrder[0]).toBeLessThan(chain.limit.mock.invocationCallOrder[0]);
  });
  it('honours a current escalation', async () => {
    query([{ source: 'bot_outbound', created_at: new Date().toISOString(), escalated_at: new Date().toISOString() }]);
    expect(await isConversationSilenced('972501234567')).toBe(true);
  });
  it('does not authorise automation when the takeover query fails', async () => {
    query(null, { message: 'database unavailable' });
    await expect(isConversationSilenced('972501234567')).rejects.toThrow('human takeover');
  });
  it('allows automation when no active takeover is found', async () => {
    query([]);
    expect(await isConversationSilenced('972501234567')).toBe(false);
  });
});
