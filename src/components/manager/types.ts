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
  type: 'pickup' | 'return';
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
