import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retryPendingBookingCustomerEmails, sendBookingCustomerEmail } from '@/lib/booking-customer-email';

const mocks = vi.hoisted(() => ({ send: vi.fn(), upsert: vi.fn(), remove: vi.fn(), delivered: vi.fn(), rows: [] as unknown[] }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock('@/lib/email-delivery', () => ({ alreadyDelivered: mocks.delivered }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: () => ({
  upsert: mocks.upsert, delete: () => ({ eq: mocks.remove }),
  select: () => ({ eq: () => ({ lte: () => ({ order: () => ({ limit: async () => ({ data: mocks.rows, error: null }) }) }) }) }),
}) }) }));
beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'fictional-test-key');
  mocks.send.mockReset().mockResolvedValue({ error: null });
  mocks.upsert.mockReset().mockResolvedValue({ error: null });
  mocks.remove.mockReset().mockResolvedValue({ error: null });
  mocks.delivered.mockReset().mockResolvedValue(false);
  mocks.rows = [];
});
afterEach(() => vi.unstubAllEnvs());
const params = { kind: 'rejected' as const, idempotencyKey: 'booking_rejected:fictional', locale: 'he' as const, toEmail: 'fictional@example.invalid', customerName: 'Test <Customer>', orderId: '123456', vehicleName: 'Test <Car>', startDate: '10/12/2026', endDate: '12/12/2026', pickupLocation: 'Herzliya', returnLocation: 'Herzliya', totalPrice: '-', paymentLink: 'https://payment.example.invalid/should-not-appear' };
describe('customer rejection email', () => {
  it.each(['he', 'en'] as const)('sends the final %s text, three branches and no payment link', async locale => {
    expect(await sendBookingCustomerEmail({ ...params, locale })).toEqual({ ok: true });
    const [message, options] = mocks.send.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: params.idempotencyKey });
    expect(message.to).toBe(params.toEmail);
    for (const text of [message.html, message.text]) {
      expect(text).toContain('123456');
      for (const phone of ['09-9509757', '03-5233073', '02-6221150']) expect(text).toContain(phone);
      expect(text).not.toMatch(/נתב|Ben Gurion|Airport|payment\.example/);
      expect(text).toContain(locale === 'he' ? 'צוות SmartCar' : 'The SmartCar team');
    }
    expect(message.html).toContain('Test &lt;Customer&gt;');
    expect(message.html).not.toContain('Test <Car>');
    expect(message.subject).toContain(locale === 'he' ? 'עדכון' : 'update');
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ event: 'booking_rejected', delivered: true }), expect.anything());
  });
  it('retains a retry record if the provider is not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect((await sendBookingCustomerEmail(params)).ok).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ idempotency_key: params.idempotencyKey, kind: 'rejected', status: 'pending' }), expect.objectContaining({ ignoreDuplicates: true }));
  });
  it('cleans an already-delivered retry without emailing again', async () => {
    mocks.rows = [{ idempotency_key: params.idempotencyKey, kind: 'rejected', payload: params, attempts: 0, created_at: new Date().toISOString() }];
    mocks.delivered.mockResolvedValue(true);
    expect(await retryPendingBookingCustomerEmails()).toMatchObject({ swept: 1, delivered: 1, pending: 0 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith('idempotency_key', params.idempotencyKey);
  });
});
