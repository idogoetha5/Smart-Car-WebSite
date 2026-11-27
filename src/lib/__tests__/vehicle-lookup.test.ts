import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getVehicleById } from '@/lib/db/vehicles';

const lookup = vi.hoisted(() => ({ maybeSingle: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => lookup }) }),
  }),
}));

describe('vehicle detail lookup', () => {
  beforeEach(() => lookup.maybeSingle.mockReset());

  it('returns null for a successful lookup with no match', async () => {
    lookup.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getVehicleById('missing')).resolves.toBeNull();
  });

  it('propagates a temporary database error so it cannot become a 404', async () => {
    const error = new Error('Temporary database failure');
    lookup.maybeSingle.mockResolvedValue({ data: null, error });
    await expect(getVehicleById('existing')).rejects.toBe(error);
  });
});
