import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AdminBookingsPage from '@/app/[locale]/admin/(protected)/bookings/page';

const fixture = vi.hoisted(() => ({ status: 'CONFIRMED' }));
vi.mock('next/navigation', () => ({ useParams: () => ({ locale: 'he' }) }));
vi.mock('@/lib/swr', () => ({
  useApiList: () => ({
    items: [{ id: 'booking-fixture', customer_name: 'לקוח לדוגמה', status: fixture.status }],
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  }),
}));

describe('admin booking delete controls', () => {
  it.each(['confirmed', 'CONFIRMED', 'cancelled', 'CANCELLED', 'cancelled_by_customer', 'CANCELLED_BY_CUSTOMER', 'completed', 'COMPLETED'])(
    'exposes labelled phone and desktop delete actions for %s', (status) => {
      fixture.status = status;
      const html = renderToStaticMarkup(createElement(AdminBookingsPage));
      expect(html.match(/aria-label="מחיקת ההזמנה של לקוח לדוגמה"/g)).toHaveLength(2);
      expect(html).toContain('מחיקת הזמנה');
      expect(html).toContain('min-h-12');
    },
  );

  it.each(['pending', 'PENDING', 'active', 'ACTIVE'])(
    'preserves the no-delete guard for %s', (status) => {
      fixture.status = status;
      const html = renderToStaticMarkup(createElement(AdminBookingsPage));
      expect(html).not.toContain('aria-label="מחיקת ההזמנה');
      if (status.toLowerCase() === 'pending') {
        expect(html).toContain('אישור הזמנה');
        expect(html).toContain('סירוב');
      }
    },
  );
});
