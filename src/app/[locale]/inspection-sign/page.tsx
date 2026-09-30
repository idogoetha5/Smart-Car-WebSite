'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import InspectionSignScreen from '@/components/inspection/InspectionSignScreen';

/** Remote signing via the emailed link (fallback when the customer isn't with the driver). */
function InspectionSignForm() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const token = useSearchParams().get('token') ?? '';
  return (
    <InspectionSignScreen
      dataUrl={token ? `/api/inspections/sign?token=${encodeURIComponent(token)}` : null}
      submitUrl="/api/inspections/sign"
      submitExtra={{ token }}
      requireTurnstile
      isHe={locale === 'he'}
    />
  );
}

export default function InspectionSignPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-20" aria-busy="true" />}>
      <InspectionSignForm />
    </Suspense>
  );
}
