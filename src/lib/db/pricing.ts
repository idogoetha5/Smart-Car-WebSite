import { createAdminClient } from '@/lib/supabase/server';
import type { PricingSeason, VehiclePriceOverride } from '@/lib/seasonal';

/** Keep this list and mapSeasonRow in step — same discipline as VEHICLE_COLUMNS in lib/db/vehicles.ts. */
export const SEASON_COLUMNS = [
  'id', 'name_he', 'name_en', 'start_date', 'end_date',
  'recurs_annually', 'adjustment_percent', 'priority', 'is_active',
].join(', ');

export const OVERRIDE_COLUMNS = [
  'id', 'vehicle_id', 'season_id', 'fixed_price', 'adjustment_percent',
].join(', ');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSeasonRow(row: any): PricingSeason {
  return {
    id: row.id,
    nameHe: row.name_he,
    nameEn: row.name_en,
    startDate: row.start_date,
    endDate: row.end_date,
    recursAnnually: row.recurs_annually,
    adjustmentPercent: Number(row.adjustment_percent),
    priority: row.priority,
    isActive: row.is_active,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOverrideRow(row: any): VehiclePriceOverride {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    seasonId: row.season_id,
    fixedPrice: row.fixed_price != null ? Number(row.fixed_price) : null,
    adjustmentPercent: row.adjustment_percent != null ? Number(row.adjustment_percent) : null,
  };
}

export async function getActiveSeasons(): Promise<PricingSeason[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('pricing_seasons')
    .select(SEASON_COLUMNS)
    .eq('is_active', true)
    .order('priority', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapSeasonRow);
}

export async function getAllSeasons(): Promise<PricingSeason[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('pricing_seasons')
    .select(SEASON_COLUMNS)
    .order('priority', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapSeasonRow);
}

export async function getOverridesForVehicle(vehicleId: string): Promise<VehiclePriceOverride[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicle_price_overrides')
    .select(OVERRIDE_COLUMNS)
    .eq('vehicle_id', vehicleId);
  if (error) throw error;
  return (data ?? []).map(mapOverrideRow);
}

export async function getAllOverrides(): Promise<VehiclePriceOverride[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicle_price_overrides')
    .select(OVERRIDE_COLUMNS);
  if (error) throw error;
  return (data ?? []).map(mapOverrideRow);
}
