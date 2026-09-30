'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useApiItem } from '@/lib/swr';
import { fuelEighthsToLabel } from '@/lib/inspection-storage';
import { bookingVehicleName } from '@/lib/booking-vehicle';

interface InspectionDetail {
  id: string;
  type: 'pickup' | 'return';
  odometer_km: number;
  fuel_eighths: number;
  status: 'awaiting_signature' | 'signed';
  signed_at: string | null;
  booking: {
    customer_name: string;
    custom_vehicle_name: string | null;
    custom_license_plate?: string | null;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
}

export interface InspectionStatusViewProps {
  apiBase: string;
  id: string;
  isHe: boolean;
  /** When provided (driver flow only), renders a QR code of it while awaiting signature — a fallback for a slow email. */
  signLink?: string;
}

/**
 * "Is it signed yet" screen — the hand-the-keys-over signal. Shared by the
 * admin inspection detail page and the driver app's status page (which also
 * passes signLink for the QR fallback). No realtime infra exists in this
 * repo, so this polls every 15s while awaiting signature, plus a manual
 * refresh.
 */
export default function InspectionStatusView({ apiBase, id, isHe, signLink }: InspectionStatusViewProps) {
  const { data, isLoading, mutate } = useApiItem<{ data: InspectionDetail }>(
    `${apiBase}/${id}`,
    { refreshInterval: (latest) => (latest?.data?.status === 'awaiting_signature' ? 15_000 : 0) }
  );

  const [qrDataUrl, setQrDataUrl] = useState('');
  const inspection = data?.data;
  const signed = inspection?.status === 'signed';

  useEffect(() => {
    if (!signLink || signed) return;
    let cancelled = false;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(signLink, { width: 220, margin: 1 }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [signLink, signed]);

  if (isLoading) {
    return <div className="max-w-lg mx-auto px-4 py-16 animate-pulse h-40 bg-gray-100 rounded-2xl" />;
  }
  if (!inspection) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-500">
        {isHe ? 'הבדיקה לא נמצאה.' : 'Inspection not found.'}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10" dir={isHe ? 'rtl' : 'ltr'}>
      <div className={`rounded-2xl border p-8 text-center ${signed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        {signed ? (
          <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-3" aria-hidden="true" />
        ) : (
          <Clock className="w-14 h-14 text-amber-600 mx-auto mb-3" aria-hidden="true" />
        )}
        <h1 className="text-2xl font-black text-gray-900 mb-1">
          {signed ? (isHe ? 'נחתם ✓ — אפשר למסור מפתח' : 'Signed ✓') : (isHe ? 'ממתין לחתימת הלקוח' : 'Awaiting customer signature')}
        </h1>
        {signed && inspection.signed_at && (
          <p className="text-sm text-gray-600">
            {new Date(inspection.signed_at).toLocaleString('he-IL')}
          </p>
        )}
      </div>

      {!signed && qrDataUrl && (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm text-center">
          <p className="text-sm font-bold text-gray-700 mb-3">
            {isHe ? 'אם המייל מתעכב — הלקוח יכול לסרוק כאן' : 'If the email is slow, the customer can scan here'}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={isHe ? 'קוד QR לחתימה' : 'Signing QR code'} className="mx-auto" width={220} height={220} />
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'לקוח' : 'Customer'}</span><span className="font-bold">{inspection.booking?.customer_name}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'רכב' : 'Vehicle'}</span><span className="font-bold">{bookingVehicleName(inspection.booking)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'קילומטראז\'' : 'Odometer'}</span><span className="font-bold" dir="ltr">{inspection.odometer_km.toLocaleString('he-IL')} km</span></div>
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'דלק' : 'Fuel'}</span><span className="font-bold">{fuelEighthsToLabel(inspection.fuel_eighths)}</span></div>
      </div>

      {!signed && (
        <button
          onClick={() => mutate()}
          className="mt-4 w-full min-h-12 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white font-bold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {isHe ? 'רענון' : 'Refresh'}
        </button>
      )}
    </div>
  );
}
