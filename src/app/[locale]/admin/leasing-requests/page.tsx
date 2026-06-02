'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw, Phone, MessageCircle, Trash2 } from 'lucide-react';

type LeasingStatus = 'PENDING' | 'IN_REVIEW' | 'REJECTED';

const STATUS_CONFIG: Record<LeasingStatus, { label: string; cls: string }> = {
  PENDING:   { label: 'פתוח',  cls: 'bg-yellow-100 text-yellow-700' },
  IN_REVIEW: { label: 'מטופל', cls: 'bg-blue-100 text-blue-700' },
  REJECTED:  { label: 'סגור',  cls: 'bg-red-100 text-red-700' },
};

const STATUS_OPTIONS: Array<{ value: LeasingStatus; label: string }> = [
  { value: 'PENDING',   label: 'פתוח' },
  { value: 'IN_REVIEW', label: 'מטופל' },
  { value: 'REJECTED',  label: 'סגור' },
];

function formatDate(val: string) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('0') ? '972' + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AdminLeasingPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leasing');
      if (!res.ok) return;
      const json = await res.json();
      setRequests(json.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleStatusChange = async (id: string, status: LeasingStatus) => {
    const res = await fetch(`/api/admin/leasing-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { alert('שגיאה בעדכון הסטטוס'); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRequests(prev => prev.map((r: any) => r.id === id ? { ...r, status } : r));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`למחוק את הפנייה של ${name}?`)) return;
    const res = await fetch(`/api/admin/leasing-requests/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('שגיאה במחיקה'); return; }
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">
            {locale === 'he' ? 'ניהול ליסינג' : 'Leasing Management'}
          </h1>
          <p className="text-gray-500 mt-1">
            {requests.length} {locale === 'he' ? 'פניות' : 'requests'}
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          רענן
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {requests.length === 0 ? (
          <p className="text-center text-gray-400 py-12">אין פניות ליסינג עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-gray-500">לקוח</th>
                  <th className="p-4 font-semibold text-gray-500">טלפון</th>
                  <th className="p-4 font-semibold text-gray-500">אימייל</th>
                  <th className="p-4 font-semibold text-gray-500">רכב</th>
                  <th className="p-4 font-semibold text-gray-500">הודעה</th>
                  <th className="p-4 font-semibold text-gray-500">תאריך</th>
                  <th className="p-4 font-semibold text-gray-500">סטטוס</th>
                  <th className="p-4 font-semibold text-gray-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => {
                  const phone = r.customer_phone ?? r.customerPhone ?? '';
                  const statusKey = (r.status ?? 'PENDING') as LeasingStatus;
                  const statusConf = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.PENDING;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-gray-900">
                          {r.customer_name ?? r.customerName ?? '—'}
                        </div>
                      </td>
                      <td className="p-4 text-xs">
                        {phone ? (
                          <div className="flex flex-col gap-1">
                            <a href={`tel:${phone}`} className="flex items-center gap-1 text-[#E8743B] hover:underline">
                              <Phone className="w-3 h-3" />{phone}
                            </a>
                            <a href={waLink(phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline">
                              <MessageCircle className="w-3 h-3" />וואטסאפ
                            </a>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-4 text-gray-600 text-xs">
                        {(r.customer_email ?? r.customerEmail) ? (
                          <a href={`mailto:${r.customer_email ?? r.customerEmail}`} className="hover:underline text-blue-600">
                            {r.customer_email ?? r.customerEmail}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="p-4 text-gray-700 text-xs">
                        {r.vehicle
                          ? `${r.vehicle.make} ${r.vehicle.model}`
                          : (r.vehicle_id ? r.vehicle_id.slice(0, 8) : '—')}
                        {(r.duration_months || r.durationMonths) && (
                          <div className="text-gray-400 mt-0.5">
                            {r.duration_months ?? r.durationMonths} {locale === 'he' ? 'חודשים' : 'months'}
                            {(r.estimated_monthly || r.estimatedMonthly) ? ` · ₪${(r.estimated_monthly ?? r.estimatedMonthly).toLocaleString()}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-gray-500 text-xs max-w-[160px]">
                        <span className="line-clamp-2" title={r.notes ?? ''}>
                          {r.notes || '—'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(r.created_at ?? r.createdAt ?? '')}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusConf.cls}`}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={statusKey in STATUS_CONFIG ? statusKey : 'PENDING'}
                            onChange={e => handleStatusChange(r.id, e.target.value as LeasingStatus)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#2D5F5F]"
                          >
                            {STATUS_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleDelete(r.id, r.customer_name ?? r.customerName ?? '')}
                            title="מחק"
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
