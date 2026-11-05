import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState } from '@/lib/whatsapp-rebuild';

const backend = vi.hoisted(() => ({ rpc: vi.fn(), read: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({
  rpc: backend.rpc,
  from: (table: string) => {
    const query = { select: () => query, eq: (_column: string, phone: string) => ({ maybeSingle: () => backend.read(table, phone) }) };
    return query;
  },
}) }));
import { withSerializedPhoneTurn, mutatePhoneTurn, type PhoneTurn } from '@/lib/whatsapp-phone-turn';
import { createPersistentRebuildStore } from '@/lib/whatsapp-rebuild-store';
import { claimInboundMessage, prepareInboundReply, recordInboundSend } from '@/lib/whatsapp-inbound-journal';
import { enqueueHandoffEmail } from '@/lib/whatsapp-handoff-outbox';

type Job = { phone: string; status: string; ordinal: number; createdAt: number; deadline?: number; sendUntil?: number; token?: string; attempt?: string; reply?: string; provider?: string; escalate?: boolean };
type Lease = { id: string; token: string; until: number; deadline: number };
let clock: number, serial: number;
let jobs: Map<string, Job>, leases: Map<string, Lease>, states: Map<string, RebuildState>, requests: Map<string, string>, handoffs: Set<string>;
let insertions: number;
let manual: Map<string, { since: number; event: string }>, human: Map<string, number>;
const ok = (data: unknown) => ({ data, error: null });
const deferred = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };
function row(job: Job, token: string | null = null) {
  return { action: job.status === 'preparing' ? 'prepare' : job.status === 'prepared' ? 'prepared' : job.status === 'accepted' ? 'accepted' : job.status === 'uncertain' ? 'uncertain' : 'done', saved_reply: job.reply ?? null, should_escalate: job.escalate ?? false, saved_provider_reply_id: job.provider ?? null, turn_token: token, attempt_token: job.attempt ?? null, manual_event_id: manual.get(job.phone)?.event ?? null };
}
// Stateful RPC fixture exercises the actual TS store/journal/serialization
// integration. Real PostgreSQL locking and privileges are verified separately.
beforeEach(() => {
  clock = 1_000; serial = 0; insertions = 0;
  jobs = new Map(); leases = new Map(); states = new Map(); requests = new Map(); handoffs = new Set(); manual = new Map(); human = new Map();
  backend.read.mockReset().mockImplementation(async (table, phone) => {
    if (table !== 'whatsapp_conversation_states') throw new Error(`unfenced table ${table}`);
    return ok(states.has(phone) ? { state: structuredClone(states.get(phone)) } : null);
  });
  backend.rpc.mockReset().mockImplementation(async (name: string, p: Record<string, unknown>) => {
    const phone = String(p.p_phone), id = String(p.p_message_id);
    let job = jobs.get(id);
    const lease = leases.get(phone);
    const owned = () => {
      if (!lease || lease.id !== id || lease.token !== p.p_owner_token || lease.until <= clock || lease.deadline <= clock) throw new Error('expired owner');
      return lease;
    };
    try {
      if (name === 'claim_whatsapp_phone_turn') {
        if (!job) { job = { phone, status: 'preparing', ordinal: serial++, createdAt: clock }; jobs.set(id, job); }
        if (job.phone !== phone) throw new Error('wrong phone');
        if (['accepted', 'suppressed', 'rejected'].includes(job.status)) return ok([row(job)]);
        if (lease && lease.until > clock) return ok([{ action: 'busy' }]);
        if ([...jobs.values()].some(j => j.phone === phone && j.status === 'sending' && (j.sendUntil ?? 0) > clock)) return ok([{ action: 'busy' }]);
        const previousManual = manual.get(phone);
        if (previousManual && (human.get(phone) ?? 0) >= previousManual.since) manual.delete(phone);
        for (const item of jobs.values()) if (item.phone === phone && item.status === 'sending') item.status = 'uncertain';
        const stale = [...jobs.entries()].filter(([, j]) => j.phone === phone && ['preparing', 'prepared'].includes(j.status) && (j.deadline ?? j.createdAt + 90_000) <= clock);
        const uncertain = [...jobs.entries()].find(([, j]) => j.phone === phone && j.status === 'uncertain' && (human.get(phone) ?? 0) < j.createdAt);
        for (const [, item] of stale) item.status = 'suppressed';
        if (stale.length || uncertain) {
          const event = manual.get(phone)?.event ?? stale[0]?.[0] ?? uncertain![0];
          if (!manual.has(phone)) manual.set(phone, { since: clock, event });
          handoffs.add(`manual:${event}`);
        }
        if (job.status === 'uncertain') return ok([row(job)]);
        if (manual.has(phone) && !p.p_emergency || job.status === 'suppressed') {
          job.status = 'suppressed'; return ok([{ action: 'manual', manual_event_id: manual.get(phone)?.event }]);
        }
        const head = [...jobs.entries()].filter(([, j]) => j.phone === phone && ['preparing', 'prepared'].includes(j.status)).sort((a, b) => a[1].ordinal - b[1].ordinal)[0];
        if (!p.p_emergency && head?.[0] !== id) return ok([{ action: 'busy' }]);
        const token = `owner-${serial++}`;
        job.deadline ??= clock + 90_000; leases.set(phone, { id, token, until: Math.min(job.deadline, clock + 40_000), deadline: job.deadline }); job.token = token;
        return ok([row(job, token)]);
      }
      if (name === 'release_whatsapp_phone_turn') {
        if (lease?.id === id && lease.token === p.p_owner_token) { leases.delete(phone); return ok(true); }
        return ok(false);
      }
      if (name === 'renew_whatsapp_phone_turn') { const current = owned(); current.until = Math.min(current.deadline, clock + 40_000); return ok(true); }
      if (name === 'record_whatsapp_phone_send') {
        if (!job || job.attempt !== p.p_attempt_token || !['sending', 'uncertain'].includes(job.status)) throw new Error('wrong send attempt');
        job.status = String(p.p_status); job.provider = p.p_provider_reply_id as string; return ok(true);
      }
      if (name !== 'mutate_whatsapp_phone_turn') throw new Error('missing migration');
      owned();
      if (!job || job.token !== p.p_owner_token) throw new Error('wrong journal owner');
      const payload = p.p_payload as Record<string, unknown>;
      if (p.p_kind === 'state') states.set(phone, structuredClone(payload) as RebuildState);
      if (p.p_kind === 'request') {
        const key = String(payload.request_key);
        if (!requests.has(key)) { insertions++; requests.set(key, String(insertions)); }
        return ok({ id: requests.get(key) });
      }
      if (p.p_kind === 'handoff') handoffs.add(String(payload.key));
      if (p.p_kind === 'prepare') { job.reply = String(payload.reply); job.escalate = payload.escalate === true; job.status = job.reply ? 'prepared' : 'suppressed'; }
      if (p.p_kind === 'send') { job.status = 'sending'; job.sendUntil = clock + 40_000; job.attempt = `attempt-${serial++}`; return ok({ attemptToken: job.attempt }); }
      if (p.p_kind === 'suppress') job.status = 'suppressed';
      return ok({});
    } catch (error) { return { data: null, error }; }
  });
});

async function turn(phone: string, id: string, input: string) {
  return withSerializedPhoneTurn(phone, id, false, async owned => {
    const claim = await claimInboundMessage(id, phone, owned);
    if (claim.action !== 'prepare') return claim;
    const result = await getRebuiltBotReply(phone, input, { ...createPersistentRebuildStore(owned), readTurn: async () => null });
    await prepareInboundReply(id, result.reply, Boolean(result.escalate), owned);
    await claimInboundMessage(id, phone, owned);
    await recordInboundSend(id, { ok: true, waMessageId: `sent-${id}`, status: 200, outcome: 'accepted' }, owned);
    return result;
  });
}

describe('durable phone ownership integration', () => {
  it('rejects a distinct rapid same-phone message, then its retry retains both turns facts', async () => {
    const barrier = deferred(); let observed = false;
    const read = backend.read.getMockImplementation()!;
    backend.read.mockImplementationOnce(async (...args) => { const value = await read(...args); observed = true; await barrier.promise; return value; });
    const first = turn('972501234567', 'a', 'I want to rent a family car from Herzliya on 9 December 2026 and return in Tel Aviv on 12 December 2026. I am 36, with three passengers and one suitcase.');
    await vi.waitFor(() => expect(observed).toBe(true));
    await expect(turn('972501234567', 'b', 'Actually please return it on 13 December 2026 in Jerusalem instead of Tel Aviv.')).rejects.toThrow('already processing');
    barrier.release(); await first;
    await turn('972501234567', 'b', 'Actually please return it on 13 December 2026 in Jerusalem instead of Tel Aviv.');
    expect(states.get('972501234567')?.booking).toMatchObject({ passengers: 3, luggage: 1, pickupDate: '2026-12-09', returnDate: '2026-12-13', returnLocation: 'Jerusalem' });
  });

  it('allows a second phone to finish while the first phone is waiting', async () => {
    const gate = deferred(); let started = false;
    const first = withSerializedPhoneTurn('972501234567', 'a', false, async () => { started = true; await gate.promise; });
    await vi.waitFor(() => expect(started).toBe(true));
    await withSerializedPhoneTurn('972509876543', 'b', false, async own => { await prepareInboundReply('b', '', false, own); });
    expect(jobs.get('b')?.status).toBe('suppressed'); gate.release(); await first;
  });

  it('fences stale state, rental, handoff and journal writes and an old release cannot clear a replacement', async () => {
    const waitOld = deferred(), waitNew = deferred(); let old!: PhoneTurn; let next!: PhoneTurn;
    const a = withSerializedPhoneTurn('972501234567', 'a', false, async own => { old = own; await waitOld.promise; });
    await vi.waitFor(() => expect(old).toBeDefined());
    await expect(withSerializedPhoneTurn(old.phone, 'b', true, async () => {})).rejects.toThrow('already processing');
    clock += 41_000;
    const b = withSerializedPhoneTurn('972501234567', 'b', true, async own => { next = own; await waitNew.promise; });
    await vi.waitFor(() => expect(next).toBeDefined());
    const store = createPersistentRebuildStore(old);
    await expect(store.saveState(old.phone, ready())).rejects.toThrow('owned mutation failed');
    await expect(store.createRentalRequest(old.phone, ready())).rejects.toThrow('owned mutation failed');
    await expect(enqueueHandoffEmail(old.messageId, old.phone, old)).rejects.toThrow('owned mutation failed');
    await expect(prepareInboundReply('a', 'obsolete', false, old)).rejects.toThrow('owned mutation failed');
    waitOld.release(); await a;
    expect(leases.get(next.phone)?.token).toBe(next.ownerToken);
    await mutatePhoneTurn(next, 'state', ready()); waitNew.release(); await b;
    expect(insertions).toBe(0); expect(handoffs.size).toBe(0);
  });

  it('pauses ordinary turns behind uncertainty, permits a new safety turn, and reconciles a late accepted attempt without resending', async () => {
    let sending!: PhoneTurn;
    await withSerializedPhoneTurn('972501234567', 'a', false, async own => {
      sending = own; await prepareInboundReply('a', 'original', false, own); await claimInboundMessage('a', own.phone, own);
    });
    clock += 41_000;
    await withSerializedPhoneTurn(sending.phone, 'b', false, async own => {
      expect((await claimInboundMessage('b', own.phone, own)).action).toBe('manual');
      expect(own.manualEventId).toBe('a');
    });
    expect(jobs.get('b')?.status).toBe('suppressed');
    await withSerializedPhoneTurn(sending.phone, 'c', true, async own => { await prepareInboundReply('c', 'fixed safety', true, own); });
    await expect(recordInboundSend('a', { ok: true, waMessageId: 'wrong-attempt', status: 200, outcome: 'accepted' }, { ...sending, sendAttemptToken: 'other-attempt' })).rejects.toThrow('reconciliation failed');
    await recordInboundSend('a', { ok: true, waMessageId: 'accepted-late', status: 200, outcome: 'accepted' }, sending);
    await withSerializedPhoneTurn(sending.phone, 'a', false, async own => {
      expect((await claimInboundMessage('a', own.phone, own)).action).toBe('accepted');
    });
    expect(backend.rpc.mock.calls.filter(([name, p]) => name === 'mutate_whatsapp_phone_turn' && p.p_kind === 'send')).toHaveLength(1);
  });

  it('reuses a persisted request key after interruption before state save', async () => {
    const state = ready();
    await expect(withSerializedPhoneTurn('972501234567', 'a', false, async own => {
      expect(await createPersistentRebuildStore(own).createRentalRequest(own.phone, state)).toBe('1');
      throw new Error('interrupted before state commit');
    })).rejects.toThrow('interrupted');
    await withSerializedPhoneTurn('972501234567', 'a', false, async own => {
      expect(await createPersistentRebuildStore(own).createRentalRequest(own.phone, state)).toBe('1');
      await prepareInboundReply('a', '', false, own);
    });
    expect(insertions).toBe(1);
  });


  it('retires an abandoned unsent head to one manual handoff, retains facts, and resumes ordering only after staff reply', async () => {
    await withSerializedPhoneTurn('972501234567', 'a', false, async own => { await mutatePhoneTurn(own, 'state', ready()); });
    clock += 91_000;
    await withSerializedPhoneTurn('972501234567', 'b', false, async own => {
      expect((await claimInboundMessage('b', own.phone, own)).action).toBe('manual');
      expect(own.manualEventId).toBe('a');
    });
    await withSerializedPhoneTurn('972501234567', 'c', false, async own => expect(own.claim.action).toBe('manual'));
    expect(jobs.get('a')?.status).toBe('suppressed');
    expect(states.get('972501234567')?.booking.customerName).toBe('Fictional Test');
    expect(handoffs.size).toBe(1);
    human.set('972501234567', clock + 1); clock += 2;
    await withSerializedPhoneTurn('972501234567', 'd', false, async own => {
      expect(own.claim.action).toBe('prepare'); await prepareInboundReply('d', '', false, own);
    });
    expect(manual.has('972501234567')).toBe(false);
  });

  it('does not renew past the hard deadline and cleans up a failed renewal timer', async () => {
    vi.useFakeTimers();
    try {
      const gate = deferred(); let owned!: PhoneTurn;
      const pending = withSerializedPhoneTurn('972501234567', 'a', false, async own => { owned = own; await gate.promise; });
      await vi.advanceTimersByTimeAsync(0);
      clock += 91_000;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(owned.lost).toBe(true);
      await expect(mutatePhoneTurn(owned, 'state', ready())).rejects.toThrow('ownership unavailable');
      gate.release(); await pending;
      const calls = backend.rpc.mock.calls.length;
      await vi.advanceTimersByTimeAsync(30_000);
      expect(backend.rpc.mock.calls.length).toBe(calls);
    } finally { vi.useRealTimers(); }
  });

  it('fails closed if the new migration cannot be called', async () => {
    backend.rpc.mockResolvedValueOnce({ data: null, error: new Error('function not found') });
    const run = vi.fn(); await expect(withSerializedPhoneTurn('972501234567', 'a', false, run)).rejects.toThrow('claim unavailable');
    expect(run).not.toHaveBeenCalled();
  });
});

function ready(): RebuildState {
  return { version: 2, phase: 'booking', step: 'rental_confirm', locale: 'en', history: [], requestKey: '49e91165-5d7c-4e93-926d-5508606323d5', booking: {
    pickupDate: '2026-12-09', returnDate: '2026-12-13', pickupLocation: 'Herzliya', returnLocation: 'Tel Aviv', vehicleNeed: 'family car', driverAgeRange: '24-plus', customerName: 'Fictional Test',
  } };
}
