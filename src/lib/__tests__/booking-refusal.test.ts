import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import { PATCH } from '@/app/api/admin/bookings/[id]/route';

const mocks = vi.hoisted(() => ({ authorized: true, update: vi.fn(), rpc: vi.fn(), email: vi.fn(), delivered: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'test-session' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: async () => mocks.authorized }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: () => ({
  select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'fixture', status: 'PENDING', customer_email: 'fictional@example.invalid', customer_name: 'Test Customer', pickup_date: '2026-12-10', dropoff_date: '2026-12-12', pickup_location: 'herzliya', dropoff_location: 'herzliya', vehicle: { make: 'Test', model: 'Car' } }, error: null }) }) }),
  update: mocks.update,
}) }) }));
vi.mock('@/lib/booking-delete', () => ({ deleteBookingCascade: vi.fn() }));
vi.mock('@/lib/email-delivery', () => ({ alreadyDelivered: mocks.delivered }));
vi.mock('@/lib/booking-customer-email', () => ({ sendBookingCustomerEmail: mocks.email }));

beforeEach(() => {
  mocks.authorized = true;
  mocks.update.mockReset().mockReturnValue({ eq: () => ({ eq: () => ({ select: async () => ({ data: [{ id: 'fixture' }], error: null }) }) }) });
  mocks.rpc.mockReset().mockResolvedValue({ data: 'REJECTED', error: null });
  mocks.email.mockReset().mockResolvedValue({ ok: true });
  mocks.delivered.mockReset().mockResolvedValue(false);
});

describe('booking cancellation attribution', () => {
  it.each(['rejected', 'REJECTED'])('persists an office refusal as REJECTED (%s)', async status => {
    const response = await PATCH(new Request('https://example.invalid/api/admin/bookings/fixture', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    }), { params: Promise.resolve({ id: 'fixture' }) });
    expect(response.status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('reject_booking_with_email', expect.objectContaining({ p_booking_id: 'fixture', p_email_payload: expect.objectContaining({ kind: 'rejected', idempotencyKey: 'booking_rejected:fixture', toEmail: 'fictional@example.invalid' }) }));
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({ booking: { status: 'REJECTED' }, rejectionEmailed: true });
  });

  it('does not allow an unauthenticated refusal', async () => {
    mocks.authorized = false;
    const response = await PATCH(new Request('https://example.invalid', { method: 'PATCH' }), { params: Promise.resolve({ id: 'fixture' }) });
    expect(response.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  const refuse = () => PATCH(new Request('https://example.invalid/api/admin/bookings/fixture', { method: 'PATCH', body: JSON.stringify({ status: 'REJECTED' }) }), { params: Promise.resolve({ id: 'fixture' }) });
  it('does not email again when a concurrent transition already won', async () => {
    mocks.rpc.mockResolvedValue({ data: 'NOT_PENDING', error: null });
    expect((await refuse()).status).toBe(409);
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it('does not send if the transactional transition failed', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'outbox unavailable' } });
    expect((await refuse()).status).toBe(500);
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it('reports email failure separately from the committed refusal', async () => {
    mocks.email.mockResolvedValue({ ok: false });
    const response = await refuse();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ booking: { status: 'REJECTED' }, rejectionEmailed: false });
  });
  it('recognises a recorded earlier delivery without sending again', async () => {
    mocks.delivered.mockResolvedValue(true);
    const response = await refuse();
    expect((await response.json()).rejectionEmailed).toBe(true);
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each([
    ['REJECTED', 'he', 'סורב'], ['rejected', 'en', 'Rejected'],
    ['CANCELLED', 'he', 'בוטל'], ['CANCELLED', 'en', 'Cancelled'],
    ['CANCELLED_BY_CUSTOMER', 'he', 'בוטל ע״י הלקוח'],
    ['cancelled_by_customer', 'en', 'Cancelled by customer'],
  ])('labels %s correctly in %s', (status, locale, label) => {
    const html = renderToStaticMarkup(createElement(BookingStatusBadge, { status, locale, variant: 'admin', showIcon: false }));
    expect(html).toContain(`>${label}</span>`);
    if (status.toUpperCase() !== 'CANCELLED_BY_CUSTOMER') {
      expect(html).not.toContain('ע״י הלקוח');
      expect(html).not.toContain('by customer');
    }
  });
});
