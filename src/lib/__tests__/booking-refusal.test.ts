import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import { PATCH } from '@/app/api/admin/bookings/[id]/route';

const mocks = vi.hoisted(() => ({ authorized: true, update: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'test-session' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: async () => mocks.authorized }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: () => ({
  select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'fixture', status: 'PENDING' }, error: null }) }) }),
  update: mocks.update,
}) }) }));
vi.mock('@/lib/booking-delete', () => ({ deleteBookingCascade: vi.fn() }));
vi.mock('@/lib/email-delivery', () => ({ alreadyDelivered: vi.fn() }));
vi.mock('@/lib/booking-customer-email', () => ({ sendBookingCustomerEmail: vi.fn() }));

beforeEach(() => {
  mocks.authorized = true;
  mocks.update.mockReset().mockReturnValue({ eq: async () => ({ error: null }) });
});

describe('booking cancellation attribution', () => {
  it.each(['rejected', 'REJECTED'])('persists an office refusal as REJECTED (%s)', async status => {
    const response = await PATCH(new Request('https://example.invalid/api/admin/bookings/fixture', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    }), { params: Promise.resolve({ id: 'fixture' }) });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ status: 'REJECTED' });
    expect((await response.json()).booking.status).toBe('REJECTED');
  });

  it('does not allow an unauthenticated refusal', async () => {
    mocks.authorized = false;
    const response = await PATCH(new Request('https://example.invalid', { method: 'PATCH' }), { params: Promise.resolve({ id: 'fixture' }) });
    expect(response.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
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
