import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createInspectionToken } from '@/lib/inspection-link';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import type { DamageMark } from '@/lib/inspection-damage';

/**
 * "עבודות שבוצעו ונחתמו": signed pickup/return inspections for the drivers
 * board (admin and branch managers) — customer, car, driver, when it was
 * signed, and links to the signed PDF and video. No booking dates or
 * prices: for driver-app jobs those are placeholders.
 */
export async function listSignedInspections(): Promise<NextResponse> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(
      'id, type, signed_at, video_path, damage_marks, signed_pdf_path, driver_id, driver:drivers(name), booking:bookings(id, customer_name, custom_vehicle_name, custom_license_plate, pickup_location, dropoff_location, vehicle:vehicles(make, model, license_plate))'
    )
    .eq('status', 'signed')
    .order('signed_at', { ascending: false })
    .limit(300);
  if (error) {
    console.error('[signed-inspections] list failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const booking = row.booking as unknown as {
      customer_name: string;
      custom_vehicle_name: string | null;
    custom_license_plate?: string | null;
      pickup_location: string | null;
      dropoff_location: string | null;
      vehicle: { make: string; model: string; license_plate: string | null } | null;
    } | null;
    const token = createInspectionToken(row.id, 24);
    const address = (row.type === 'pickup' ? booking?.pickup_location : booking?.dropoff_location) ?? '';
    return {
      id: row.id,
      type: row.type,
      signedAt: row.signed_at,
      customerName: booking?.customer_name ?? '',
      vehicleName: bookingVehicleName(booking),
      licensePlate: bookingLicensePlate(booking),
      address: address === 'לא צוין' ? '' : address,
      driverId: row.driver_id,
      driverName: (row.driver as unknown as { name: string } | null)?.name ?? '',
      damageCount: ((row.damage_marks ?? []) as DamageMark[]).length,
      pdfUrl: row.signed_pdf_path ? `/insp-pdf/${encodeURIComponent(token)}` : null,
      videoUrl: row.video_path ? `/insp-video/${encodeURIComponent(token)}` : null,
    };
  });
  return NextResponse.json({ data: rows });
}
