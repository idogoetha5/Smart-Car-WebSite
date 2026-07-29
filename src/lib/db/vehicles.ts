import { createAdminClient } from '@/lib/supabase/server';
import type { Vehicle, VehicleFilters } from '@/types';

/**
 * Exactly the columns mapRow reads — nothing is fetched that is not returned.
 *
 * These reads all run through the service-role client, which RLS does not
 * constrain, so `select('*')` pulled every column of the row into the
 * response object and left `mapRow` as the only thing standing between the
 * table and the public JSON. `license_plate` is the one that matters today,
 * but the real problem is the default: a column added to `vehicles` later
 * would be fetched automatically, and any future code that returns a raw row
 * rather than a mapped one would leak it without anyone editing this file.
 *
 * Keep this list and mapRow in step. Adding a field to the API means adding
 * it in both places, deliberately.
 */
export const VEHICLE_COLUMNS = [
  'id', 'make', 'model', 'year', 'category', 'transmission', 'fuel_type',
  'seats', 'doors', 'price_per_day', 'price_per_month', 'deposit_amount',
  'mileage_limit', 'image_urls', 'features', 'is_available', 'is_featured',
  'color_he', 'color_en', 'description_he', 'description_en', 'total_units',
  'created_at', 'updated_at',
].join(', ');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRow(row: any): Vehicle {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    category: row.category,
    transmission: row.transmission,
    fuelType: row.fuel_type,
    seats: row.seats,
    doors: row.doors,
    pricePerDay: row.price_per_day ?? 0,
    pricePerMonth: row.price_per_month,
    depositAmount: row.deposit_amount,
    mileageLimit: row.mileage_limit,
    imageUrls: row.image_urls ?? [],
    features: row.features ?? [],
    isAvailable: row.is_available,
    isFeatured: row.is_featured,
    colorHe: row.color_he,
    colorEn: row.color_en,
    descriptionHe: row.description_he,
    descriptionEn: row.description_en,
    totalUnits: row.total_units,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getVehicles(filters?: VehicleFilters): Promise<Vehicle[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .order('created_at', { ascending: false });

  if (filters?.category && filters.category !== 'ALL') {
    query = query.eq('category', filters.category);
  }
  if (filters?.transmission && filters.transmission !== 'ALL') {
    query = query.eq('transmission', filters.transmission);
  }
  if (filters?.fuelType && filters.fuelType !== 'ALL') {
    query = query.eq('fuel_type', filters.fuelType);
  }
  if (filters?.maxPricePerDay) {
    query = query.lte('price_per_day', filters.maxPricePerDay);
  }
  if (filters?.isAvailable !== undefined) {
    query = query.eq('is_available', filters.isAvailable);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getFeaturedVehicles(): Promise<Vehicle[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .eq('is_featured', true)
    .eq('is_available', true)
    .order('make', { ascending: true })
    .order('model', { ascending: true })
    .limit(3);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .eq('id', id)
    .single();

  if (error) return null;
  return mapRow(data);
}
