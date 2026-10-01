'use client';

import { AlertTriangle, FileText, Video } from 'lucide-react';
import type { SignedJob } from './types';

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} · ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

/** A signed handover/return form: who, which car, when, damage, and the PDF/video. */
export default function DocRow({ job }: { job: SignedJob }) {
  const pickup = job.type === 'pickup';
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${pickup ? 'bg-orange-50 text-[#E8743B]' : 'bg-[#eef6f6] text-[#2D5F5F]'}`}>
        <FileText className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-black text-[#0D2B2B]">
          {job.customerName || 'ללא שם לקוח'}
          <span className={`ms-2 text-xs font-black ${pickup ? 'text-[#E8743B]' : 'text-[#2D5F5F]'}`}>{pickup ? 'מסירה' : 'החזרה'}</span>
        </p>
        <p className="flex min-w-0 gap-1 text-sm text-gray-500">
          <span className="truncate">{job.vehicleName}</span>
          {job.licensePlate && job.licensePlate !== '—' ? <><span aria-hidden="true">·</span><span className="shrink-0 font-bold text-gray-700" dir="ltr">{job.licensePlate}</span></> : null}
          {job.driverName ? <><span aria-hidden="true">·</span><span className="shrink-0">{job.driverName}</span></> : null}
        </p>
        <p className="flex items-center gap-2 text-sm text-gray-400">
          {when(job.signedAt)}
          {job.damageCount > 0 && (
            <span className={`inline-flex items-center gap-1 font-black ${pickup ? 'text-gray-500' : 'text-red-600'}`}>
              {!pickup && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
              {job.damageCount} {pickup ? 'נזקים מתועדים' : 'נזקים חדשים'}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {job.videoUrl && (
          <a href={job.videoUrl} target="_blank" rel="noopener noreferrer" aria-label="סרטון" className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100">
            <Video className="h-5 w-5" aria-hidden="true" />
          </a>
        )}
        {job.pdfUrl && (
          <a href={job.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-full bg-[#2D5F5F] px-4 text-sm font-black text-white hover:bg-[#244e4e]">
            PDF
          </a>
        )}
      </div>
    </div>
  );
}
