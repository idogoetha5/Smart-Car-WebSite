export type Locale = 'en' | 'he';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  category: VehicleCategory;
  transmission: Transmission;
  fuelType: FuelType;
  seats: number;
  doors: number;
  pricePerDay: number;
  pricePerMonth: number;
  depositAmount: number;
  mileageLimit?: number;
  imageUrls: string[];
  features: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  colorHe?: string;
  colorEn?: string;
  descriptionHe?: string;
  descriptionEn?: string;
  totalUnits: number;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerIdNumber?: string;
  pickupDate: string;
  dropoffDate: string;
  pickupLocation: string;
  dropoffLocation: string;
  totalDays: number;
  pricePerDay: number;
  totalPrice: number;
  depositPaid: boolean;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
}

export interface LeasingRequest {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName?: string;
  durationMonths: number;
  downPayment: number;
  estimatedMonthly: number;
  mileagePackage: number;
  status: LeasingStatus;
  notes?: string;
  createdAt: string;
}

export interface VehicleFilters {
  category?: VehicleCategory | 'ALL' | 'ECONOMY_COMPACT';
  transmission?: Transmission | 'ALL';
  fuelType?: FuelType | 'ALL';
  maxPricePerDay?: number;
  isAvailable?: boolean;
  search?: string;
  seats?: number | null;
}

export type VehicleCategory =
  | 'MINI'
  | 'ECONOMY'
  | 'COMPACT'
  | 'SEDAN'
  | 'CROSSOVER'
  | 'SUV'
  | 'LUXURY'
  | 'VAN'
  | 'COMMERCIAL'
  | 'ELECTRIC';

export type Transmission = 'AUTOMATIC' | 'MANUAL';
export type FuelType = 'GASOLINE' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';
export type LeasingStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
