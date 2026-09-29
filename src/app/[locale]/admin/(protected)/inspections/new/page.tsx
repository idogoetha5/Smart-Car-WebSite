'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import InspectionForm from '@/components/inspection/InspectionForm';

function AdminNewInspectionInner() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId') ?? '';
  const type = searchParams.get('type') === 'return' ? 'return' : 'pickup';

  return (
    <InspectionForm
      apiBase="/api/admin/inspections"
      bookingId={bookingId}
      type={type}
      isHe={isHe}
      statusHref={(id) => `/${locale}/admin/inspections/${id}`}
    />
  );
}

export default function NewInspectionPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-16" aria-busy="true" />}>
      <AdminNewInspectionInner />
    </Suspense>
  );
}
