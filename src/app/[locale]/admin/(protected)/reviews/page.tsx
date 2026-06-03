'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw, Check, X, Trash2, Star } from 'lucide-react';

type Review = {
  id: string;
  name: string;
  rating: number;
  text: string;
  date: string;
  approved: boolean;
};

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3 h-3 ${i <= n ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminReviewsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [tab, setTab] = useState<'pending' | 'approved' | 'all'>('pending');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch('/api/admin/reviews');
      if (res.status === 401) { setFetchError('פג תוקף הסשן — נסה להתחבר מחדש'); return; }
      if (!res.ok) { setFetchError(`שגיאה בשרת (${res.status})`); return; }
      const json = await res.json();
      setReviews(json.data ?? []);
    } catch {
      setFetchError('שגיאת רשת — נסה לרענן');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const approve = async (id: string) => {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true }),
    });
    if (!res.ok) { alert('שגיאה'); return; }
    setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: true } : r));
  };

  const reject = async (id: string) => {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: false }),
    });
    if (!res.ok) { alert('שגיאה'); return; }
    setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: false } : r));
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm('למחוק ביקורת זו?')) return;
    const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('שגיאה במחיקה'); return; }
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  const filtered = reviews.filter(r => {
    if (tab === 'pending') return !r.approved;
    if (tab === 'approved') return r.approved;
    return true;
  });

  const pendingCount = reviews.filter(r => !r.approved).length;

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">
            {locale === 'he' ? 'ניהול ביקורות' : 'Reviews Management'}
          </h1>
          <p className="text-gray-500 mt-1">
            {reviews.length} {locale === 'he' ? 'ביקורות סה"כ' : 'total reviews'}
            {pendingCount > 0 && (
              <span className="mr-2 text-amber-600 font-semibold">· {pendingCount} {locale === 'he' ? 'ממתינות לאישור' : 'pending approval'}</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchReviews}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {locale === 'he' ? 'רענן' : 'Refresh'}
        </button>
      </div>

      {fetchError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
          ⚠️ {fetchError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-0">
        {([
          { key: 'pending', labelHe: `ממתינות (${pendingCount})`, labelEn: `Pending (${pendingCount})` },
          { key: 'approved', labelHe: `מאושרות (${reviews.filter(r => r.approved).length})`, labelEn: `Approved (${reviews.filter(r => r.approved).length})` },
          { key: 'all',     labelHe: `הכל (${reviews.length})`,  labelEn: `All (${reviews.length})` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-[#E8743B] text-[#E8743B]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {locale === 'he' ? t.labelHe : t.labelEn}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12">
            {locale === 'he' ? 'אין ביקורות בקטגוריה זו' : 'No reviews in this category'}
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(r => (
              <div key={r.id} className={`p-5 hover:bg-gray-50 transition-colors ${!r.approved ? 'bg-amber-50/30' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-bold text-gray-900">{r.name}</span>
                      <Stars n={r.rating} />
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        r.approved
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.approved ? (locale === 'he' ? 'מאושר' : 'Approved') : (locale === 'he' ? 'ממתין' : 'Pending')}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(r.date)}</span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{r.text}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!r.approved && (
                      <button
                        onClick={() => approve(r.id)}
                        title={locale === 'he' ? 'אשר' : 'Approve'}
                        className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {r.approved && (
                      <button
                        onClick={() => reject(r.id)}
                        title={locale === 'he' ? 'בטל אישור' : 'Unapprove'}
                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteReview(r.id)}
                      title={locale === 'he' ? 'מחק' : 'Delete'}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
