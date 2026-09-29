'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import InspectionForm from '@/components/inspection/InspectionForm';

function DriverNewInspectionInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId') ?? '';
  const type = searchParams.get('type') === 'return' ? 'return' : 'pickup';

  return (
    <InspectionForm
      apiBase="/api/driver/inspections"
      bookingId={bookingId}
      type={type}
      isHe
      statusHref={(id, signLink) => `/driver/inspection/${id}?signLink=${encodeURIComponent(signLink)}`}
    />
  );
}

export default function DriverNewInspectionPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-16" aria-busy="true" />}>
      <DriverNewInspectionInner />
    </Suspense>
  );
}
