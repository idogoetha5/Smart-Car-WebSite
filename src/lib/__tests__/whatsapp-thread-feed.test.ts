import { describe, expect, it, vi } from 'vitest';
import { WhatsAppThreadFeed, type ThreadMessage, type ThreadPage } from '@/lib/whatsapp-thread-feed';
const row = (id: number): ThreadMessage => ({ id, source: 'customer_inbound', body: `fictional ${id}`, created_at: '2030-01-01T00:00:00Z', escalated_at: null });
function setup(count = 1020) {
  const rows = Array.from({ length: count }, (_, i) => row(i + 1));
  const read = vi.fn(async (url: string): Promise<ThreadPage> => {
    const search = new URL(url, 'https://example.test').searchParams;
    const before = Number(search.get('before'));
    const after = Number(search.get('after'));
    const selected = rows.filter(message => (!before || message.id < before) && (!after || message.id > after)).sort((a, b) => after ? a.id - b.id : b.id - a.id);
    const data = selected.slice(0, 100).sort((a, b) => a.id - b.id);
    return { data, pagination: { hasMore: selected.length > 100, before: data[0]?.id ?? null, after: data.at(-1)?.id ?? null } };
  });
  return { rows, read, feed: new WhatsAppThreadFeed('/thread', read) };
}
describe('complete paginated thread feed', () => {
  it('opens at the latest messages and traverses all 1020 equal-timestamp messages without duplicates', async () => {
    const { feed } = setup();
    expect((await feed.refresh()).messages.map(message => message.id)).toEqual(Array.from({ length: 100 }, (_, i) => i + 921));
    while (feed.snapshot().hasOlder) await feed.loadOlder();
    expect(feed.snapshot().messages.map(message => message.id)).toEqual(Array.from({ length: 1020 }, (_, i) => i + 1));
  });
  it('loads a burst beyond one page without skipping messages or discarding loaded history', async () => {
    const { rows, feed } = setup();
    await feed.refresh(); await feed.loadOlder();
    rows.push(...Array.from({ length: 350 }, (_, i) => row(1021 + i)));
    const result = await feed.refresh();
    expect(result.messages.map(message => message.id)).toEqual(Array.from({ length: 550 }, (_, i) => i + 821));
    expect(result.hasOlder).toBe(true);
  });
  it('continues large bursts in later refreshes rather than dropping an unfinished cursor', async () => {
    const { rows, feed } = setup(100);
    await feed.refresh(); rows.push(...Array.from({ length: 800 }, (_, i) => row(101 + i)));
    expect((await feed.refresh()).messages).toHaveLength(600);
    expect((await feed.refresh()).messages).toHaveLength(900);
  });
  it('retains both cursor and messages on a failed history request', async () => {
    const { feed, read } = setup(); await feed.refresh();
    read.mockRejectedValueOnce(new Error('offline'));
    await expect(feed.loadOlder()).rejects.toThrow('offline');
    expect(feed.snapshot().messages).toHaveLength(100);
    expect(feed.snapshot().hasOlder).toBe(true);
    expect((await feed.loadOlder()).messages).toHaveLength(200);
  });
  it('coalesces overlapping polls', async () => {
    const { feed, read } = setup();
    const first = feed.refresh(); const second = feed.refresh();
    expect(first).toBe(second); await first;
    expect(read).toHaveBeenCalledTimes(1);
  });
});
