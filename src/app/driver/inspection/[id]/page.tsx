'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import InspectionStatusView from '@/components/inspection/InspectionStatusView';

function DriverInspectionStatusInner() {
  const params = useParams();
  const id = params?.id as string;
  const searchParams = useSearchParams();
  const signLink = searchParams.get('signLink') ?? undefined;

  return <InspectionStatusView apiBase="/api/driver/inspections" id={id} isHe signLink={signLink} />;
}

export default function DriverInspectionStatusPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-16" aria-busy="true" />}>
      <DriverInspectionStatusInner />
    </Suspense>
  );
}
