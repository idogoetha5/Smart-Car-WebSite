'use client';

import { useSearchParams } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { numericOrderReference } from '@/lib/order-reference';

interface StoredRequest {
  ref?: string;
  vehicle?: string;
  start?: string;
  end?: string;
  emailSent?: boolean;
}

/** The value never changes after mount, so there is nothing to subscribe to. */
const subscribeNoop = () => () => {};

// getSnapshot must be referentially stable or React loops, so the parsed
// object is cached after the first read.
let cachedRequest: StoredRequest | null = null;
let hasRead = false;

function readStoredRequest(): StoredRequest | null {
  if (hasRead) return cachedRequest;
  hasRead = true;
  try {
    const raw = sessionStorage.getItem('smartcar:last-request');
    cachedRequest = raw ? (JSON.parse(raw) as StoredRequest) : null;
  } catch {
    cachedRequest = null;
  }
  return cachedRequest;
}

const formatDate = (dateStr: string | null, isHe: boolean) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(isHe ? 'he-IL' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/** Same box with placeholders, shown in the pre-rendered HTML until the browser fills it in. */
export function RequestDetailsBox({
  isHe, confirmationNumber, vehicleName, startDate, endDate, emailSent,
}: {
  isHe: boolean; confirmationNumber: string; vehicleName: string | null; startDate: string | null; endDate: string | null; emailSent: boolean;
}) {
  return (
    <>
      <div className="bg-[#f0f7f7] border-s-4 border-[#2D5F5F] rounded-xl p-5 mb-6">
        <div className="text-center mb-4">
          <p className="text-sm text-gray-600">{isHe ? 'מספר בקשה' : 'Request number'}</p>
          <p className="text-3xl font-bold text-[#B64916]">#{confirmationNumber}</p>
        </div>
        <div className="space-y-2 text-sm">
          {vehicleName && (
            <div className="flex justify-between">
              <span className="text-gray-600">{isHe ? 'רכב' : 'Vehicle'}</span>
              <span className="font-medium">{vehicleName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">{isHe ? 'תאריך איסוף' : 'Pickup date'}</span>
            <span className="font-medium">{formatDate(startDate, isHe)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{isHe ? 'תאריך החזרה' : 'Return date'}</span>
            <span className="font-medium">{formatDate(endDate, isHe)}</span>
          </div>
        </div>
      </div>

      <div className="bg-orange-50 border border-[#B64916] rounded-xl p-4 mb-6 text-center">
        <p className="text-sm text-gray-600">
          📧 {emailSent
            ? (isHe ? 'שלחנו לך אישור למייל' : 'We sent a confirmation to your email')
            : (isHe ? 'שמרנו את הבקשה שלך — אם לא קיבלת אישור למייל, ניתן ליצור קשר' : "We've saved your request — if you don't receive an email confirmation, feel free to reach out")}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          📞 {isHe ? 'לשאלות:' : 'Questions:'} <strong>09-9509757</strong>
        </p>
      </div>
    </>
  );
}

export default function RequestDetails({ isHe }: { isHe: boolean }) {
  const searchParams = useSearchParams();

  // Read from sessionStorage rather than the query string, so no booking id,
  // vehicle or dates end up in the URL. Falls back to a generic confirmation
  // when the entry is missing — a refresh in a new tab, or private mode.
  //
  // useSyncExternalStore rather than an effect: the server snapshot is null,
  // the client snapshot is the stored value, and hydration is correct without
  // a setState-in-effect cascade.
  const details = useSyncExternalStore(subscribeNoop, readStoredRequest, () => null);

  // The same numeric reference the customer receives by email, so the number
  // on screen and the number in the inbox always match.
  const idFromQuery = searchParams.get('id');
  const confirmationNumber =
    details?.ref ?? (idFromQuery ? numericOrderReference(idFromQuery) : 'PENDING');

  return (
    <RequestDetailsBox
      isHe={isHe}
      confirmationNumber={confirmationNumber}
      vehicleName={details?.vehicle ?? null}
      startDate={details?.start ?? null}
      endDate={details?.end ?? null}
      emailSent={details?.emailSent !== false}
    />
  );
}
