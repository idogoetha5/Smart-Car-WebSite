import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, locale = 'he-IL'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateTotalDays(pickupDate: Date, dropoffDate: Date): number {
  return Math.ceil(
    (dropoffDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function calculateLeasingMonthly(
  vehiclePricePerMonth: number,
  durationMonths: number,
  downPayment: number,
  mileagePackage: number
): number {
  const mileageFees: Record<number, number> = {
    10000: 0,
    15000: 150,
    20000: 300,
    30000: 600,
  };
  const mileageFee = mileageFees[mileagePackage] ?? 0;
  const base =
    (vehiclePricePerMonth * durationMonths * 0.85 - downPayment) /
    durationMonths;
  return Math.max(0, Math.round(base + mileageFee));
}
