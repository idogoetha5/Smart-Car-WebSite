'use client';

import { useMemo, useState } from 'react';
import { FileCheck2, Search } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { useManager } from './ManagerData';
import { TaskList } from './TaskRow';
import DocRow from './DocRow';

/** Every signed handover/return form, newest first, with search and a type filter. */
export default function DocumentsView() {
  const { signedJobs, loading } = useManager();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | 'pickup' | 'return'>('all');

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return signedJobs
      .filter((j) => type === 'all' || j.type === type)
      .filter((j) => !needle || [j.customerName, j.address, j.licensePlate, j.driverName, j.vehicleName].some((v) => (v ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => (b.signedAt ?? '').localeCompare(a.signedAt ?? ''));
  }, [signedJobs, query, type]);

  return (
    <div>
      <h1 className="text-2xl font-black text-[#0D2B2B] sm:text-3xl">מסמכים</h1>
      <p className="mb-5 text-sm text-gray-500">טפסי מסירה והחזרה חתומים</p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-4 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="לקוח, רכב, נהג או כתובת"
            className="min-h-12 w-full rounded-full border border-gray-200 bg-white ps-12 pe-4 text-base shadow-sm focus:border-[#2D5F5F] focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10"
          />
        </div>
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-black/[0.04]">
          {([['all', 'הכל'], ['pickup', 'מסירות'], ['return', 'החזרות']] as const).map(([key, text]) => (
            <button key={key} onClick={() => setType(key)} aria-pressed={type === key} className={`min-h-11 flex-1 rounded-full px-4 text-sm font-black transition sm:flex-none ${type === key ? 'bg-[#2D5F5F] text-white' : 'text-gray-500'}`}>
              {text}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-white" />
      ) : shown.length ? (
        <TaskList>{shown.map((j) => <DocRow key={j.id} job={j} />)}</TaskList>
      ) : (
        <EmptyState icon={FileCheck2} title={query ? 'לא נמצא' : 'עוד אין מסמכים חתומים'} text={query ? undefined : 'כל טופס שהלקוח חותם עליו יופיע כאן.'} />
      )}
    </div>
  );
}
