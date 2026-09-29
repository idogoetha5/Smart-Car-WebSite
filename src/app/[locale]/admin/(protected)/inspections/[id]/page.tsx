'use client';

import { useParams } from 'next/navigation';
import InspectionStatusView from '@/components/inspection/InspectionStatusView';

export default function InspectionStatusPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';
  const id = params?.id as string;

  return <InspectionStatusView apiBase="/api/admin/inspections" id={id} isHe={isHe} />;
}
