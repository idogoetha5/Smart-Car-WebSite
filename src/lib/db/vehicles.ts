import { createAdminClient } from '@/lib/supabase/server';
import type { Vehicle, VehicleFilters } from '@/types';

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
    .select('*')
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
    .select('*')
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
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return mapRow(data);
}
