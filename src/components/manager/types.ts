import type { BookingVehicleSource } from '@/lib/booking-vehicle';

export interface ManagerDriver {
  id: string;
  name: string;
  active: boolean;
  role?: 'driver' | 'manager';
  created_at: string;
  pushEnabled?: boolean;
}

export interface SignedJob {
  id: string;
  type: 'pickup' | 'return';
  signedAt: string | null;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  address: string;
  driverName: string;
  damageCount: number;
  pdfUrl: string | null;
  videoUrl: string | null;
}

export interface ManagerTask {
  id: string;
  /** "עכשיו" / "תוך שעה" — highlighted everywhere; offered to all drivers when unassigned. */
  urgent?: boolean;
  type: 'pickup' | 'return' | 'service';
  /** Service (garage / tyre shop) jobs — no booking, their own car, day and place. */
  scheduled_at?: string | null;
  scheduled_time?: string | null;
  location?: string | null;
  service_kind?: string | null;
  service_reason?: string | null;
  service_place?: string | null;
  custom_vehicle_name?: string | null;
  custom_license_plate?: string | null;
  car?: { make: string; model: string; license_plate: string | null } | null;
  status: 'open' | 'done' | 'cancelled';
  notes: string | null;
  assigned_driver_id: string | null;
  booking: (BookingVehicleSource & {
    id?: string;
    customer_name: string;
    customer_phone?: string | null;
    pickup_date: string;
    dropoff_date: string;
    pickup_time?: string | null;
    return_time?: string | null;
    pickup_location: string;
    dropoff_location: string;
  }) | null;
  inspection: { id: string; status: 'awaiting_signature' | 'signed' } | null;
}

/** Car of any task: the rental's car, or a service job's own car. */
export function taskCar(task: ManagerTask): BookingVehicleSource | null {
  if (task.type === 'service') return { vehicle: task.car ?? null, custom_vehicle_name: task.custom_vehicle_name, custom_license_plate: task.custom_license_plate };
  return task.booking;
}
