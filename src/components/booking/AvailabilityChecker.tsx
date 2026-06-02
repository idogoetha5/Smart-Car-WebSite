'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAvailability } from '@/hooks/useAvailability';

interface AvailabilityCheckerProps {
  vehicleId: string;
  pickupDate: string;
  dropoffDate: string;
}

export function AvailabilityChecker({
  vehicleId,
  pickupDate,
  dropoffDate,
}: AvailabilityCheckerProps) {
  const t = useTranslations('booking');
  const { available, isChecking, checkAvailability } = useAvailability();

  useEffect(() => {
    if (vehicleId && pickupDate && dropoffDate) {
      checkAvailability(vehicleId, pickupDate, dropoffDate);
    }
  }, [vehicleId, pickupDate, dropoffDate, checkAvailability]);

  if (isChecking) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{t('availability_check')}...</span>
      </div>
    );
  }

  if (available === null) return null;

  return (
    <div
      className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 ${
        available
          ? 'bg-green-50 text-green-700'
          : 'bg-red-50 text-red-700'
      }`}
    >
      {available ? (
        <CheckCircle className="w-4 h-4" />
      ) : (
        <XCircle className="w-4 h-4" />
      )}
      <span>{available ? t('available_message') : t('unavailable_message')}</span>
    </div>
  );
}
