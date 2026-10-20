import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/search-console', () => ({ getSearchConsoleOverview: async () => null }));
vi.mock('@/lib/db/vehicles', () => ({ getVehicles: async () => [] }));
vi.mock('@/lib/db/bookings', () => ({
  getActiveBookingsCount: async () => 0,
  getPendingBookingsCount: async () => 0,
  getRecentBookings: async () => [],
  getMonthlyRevenue: async () => 0,
}));
vi.mock('@/lib/db/leasing', () => ({ getPendingLeasingCount: async () => 0 }));

import AdminDashboard from '@/app/[locale]/admin/(protected)/page';

describe('dashboard lead destinations', () => {
  it.each(['he', 'en'])('offers both destinations directly in %s', async (locale) => {
    const html = renderToStaticMarkup(await AdminDashboard({ params: Promise.resolve({ locale }) }));
    expect(html).toContain(`href="/${locale}/admin/leads"`);
    expect(html).toContain('href="https://docs.google.com/spreadsheets/d/1Ve0QjN471GdNno0mxfRkHmigozjRoBdoOr84PFNZH04/edit" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain(locale === 'he' ? 'פניות ולידים בממשק' : 'Leads workspace');
    expect(html).toContain(locale === 'he' ? 'פתיחת גיליון Google Sheets' : 'Open Google Sheets');
    expect(html).toContain(`href="/${locale}/admin/search-performance"`);
    expect(html).not.toContain(locale === 'he' ? 'פעולות מהירות' : 'Quick actions');
  });
});
