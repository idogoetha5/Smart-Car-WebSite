'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { HttpError, fetcher, useApiList } from '@/lib/swr';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, X } from 'lucide-react';
import type { PricingSeason, VehiclePriceOverride } from '@/lib/seasonal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Vehicle = any;

const EMPTY_SEASON = {
  name_he: '', name_en: '', start_date: '', end_date: '',
  recurs_annually: false, adjustment_percent: 0, priority: 0, is_active: true,
};
type SeasonForm = typeof EMPTY_SEASON;

const EMPTY_OVERRIDE = {
  vehicle_id: '', season_id: '', override_type: 'fixed' as 'fixed' | 'percent', value: '',
};
type OverrideForm = typeof EMPTY_OVERRIDE;

export default function AdminPricingPage() {
  const router = useRouter();
  const onAuthError = (err: unknown) => {
    if (err instanceof HttpError && err.status === 401) router.push('/he/admin/login');
  };

  const { items: seasons, isLoading: seasonsLoading, mutate: refetchSeasons } =
    useApiList<PricingSeason>('/api/admin/pricing-seasons', { onError: onAuthError });
  const { items: overrides, isLoading: overridesLoading, mutate: refetchOverrides } =
    useApiList<VehiclePriceOverride>('/api/admin/pricing-overrides', { onError: onAuthError });
  const { data: vehiclesData } = useSWR<Vehicle[]>('/api/admin/vehicles', fetcher, { onError: onAuthError });
  const vehicles = useMemo(() => (Array.isArray(vehiclesData) ? vehiclesData : []), [vehiclesData]);

  const vehicleLabel = (id: string) => {
    const v = vehicles.find(v => v.id === id);
    return v ? `${v.make} ${v.model} (${v.year})` : id;
  };
  const seasonLabel = (id: string) => seasons.find(s => s.id === id)?.nameHe ?? id;

  // ---------------- Seasons ----------------
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [editSeason, setEditSeason] = useState<PricingSeason | null>(null);
  const [seasonForm, setSeasonForm] = useState<SeasonForm>({ ...EMPTY_SEASON });
  const [savingSeason, setSavingSeason] = useState(false);

  const openAddSeason = () => { setEditSeason(null); setSeasonForm({ ...EMPTY_SEASON }); setShowAddSeason(true); };
  const openEditSeason = (s: PricingSeason) => {
    setEditSeason(s);
    setSeasonForm({
      name_he: s.nameHe, name_en: s.nameEn, start_date: s.startDate, end_date: s.endDate,
      recurs_annually: s.recursAnnually, adjustment_percent: s.adjustmentPercent,
      priority: s.priority, is_active: s.isActive,
    });
    setShowAddSeason(false);
  };
  const closeSeasonModal = () => { setShowAddSeason(false); setEditSeason(null); };

  const handleSaveSeason = async () => {
    setSavingSeason(true);
    if (editSeason) {
      await fetch(`/api/admin/pricing-seasons/${editSeason.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(seasonForm),
      });
    } else {
      await fetch('/api/admin/pricing-seasons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(seasonForm),
      });
    }
    setSavingSeason(false);
    closeSeasonModal();
    refetchSeasons();
  };

  const handleDeleteSeason = async (id: string, name: string) => {
    if (!window.confirm(`למחוק את העונה "${name}"? כל ההתאמות האישיות שלה לרכבים יימחקו גם הן.`)) return;
    await fetch(`/api/admin/pricing-seasons/${id}`, { method: 'DELETE' });
    refetchSeasons();
    refetchOverrides();
  };

  const setSeason = (key: keyof SeasonForm, value: string | number | boolean) =>
    setSeasonForm(prev => ({ ...prev, [key]: value }));

  // ---------------- Overrides ----------------
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [editOverride, setEditOverride] = useState<VehiclePriceOverride | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({ ...EMPTY_OVERRIDE });
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  const openAddOverride = () => {
    setEditOverride(null);
    setOverrideForm({ ...EMPTY_OVERRIDE, vehicle_id: vehicles[0]?.id ?? '', season_id: seasons[0]?.id ?? '' });
    setOverrideError('');
    setShowAddOverride(true);
  };
  const openEditOverride = (o: VehiclePriceOverride) => {
    setEditOverride(o);
    setOverrideForm({
      vehicle_id: o.vehicleId, season_id: o.seasonId,
      override_type: o.fixedPrice != null ? 'fixed' : 'percent',
      value: String(o.fixedPrice != null ? o.fixedPrice : o.adjustmentPercent),
    });
    setOverrideError('');
    setShowAddOverride(false);
  };
  const closeOverrideModal = () => { setShowAddOverride(false); setEditOverride(null); };

  const handleSaveOverride = async () => {
    setOverrideError('');
    setSavingOverride(true);
    const payload = {
      vehicle_id: overrideForm.vehicle_id,
      season_id: overrideForm.season_id,
      fixed_price: overrideForm.override_type === 'fixed' ? Number(overrideForm.value) : null,
      adjustment_percent: overrideForm.override_type === 'percent' ? Number(overrideForm.value) : null,
    };
    const res = editOverride
      ? await fetch(`/api/admin/pricing-overrides/${editOverride.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      : await fetch('/api/admin/pricing-overrides', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
    setSavingOverride(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setOverrideError(body.error === 'duplicate key value violates unique constraint "vehicle_price_overrides_vehicle_id_season_id_key"'
        ? 'כבר קיימת התאמה אישית לרכב ולעונה הזו — ערוך אותה במקום'
        : (body.error || 'שגיאת שרת, נסה שוב'));
      return;
    }
    closeOverrideModal();
    refetchOverrides();
  };

  const handleDeleteOverride = async (id: string) => {
    if (!window.confirm('למחוק את ההתאמה האישית? הרכב יחזור למחיר ברירת המחדל של העונה.')) return;
    await fetch(`/api/admin/pricing-overrides/${id}`, { method: 'DELETE' });
    refetchOverrides();
  };

  const loading = seasonsLoading || overridesLoading;
  if (loading) return (
    <div className="p-4 sm:p-8">
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-200 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">מחירי רכבים</h1>
        <p className="text-gray-500 mt-1">עונות ומחירי ברירת מחדל, והתאמות אישיות לרכב ספציפי</p>
      </div>

      {/* ============ Seasons ============ */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">עונות</h2>
        <button
          onClick={openAddSeason}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#E8743B] text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
        >
          + הוסף עונה
        </button>
      </div>

      {(showAddSeason || editSeason !== null) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto text-right shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">{editSeason ? `ערוך — ${editSeason.nameHe}` : 'הוסף עונה חדשה'}</h2>
              <button onClick={closeSeasonModal} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">שם (עברית)</label>
                <input type="text" value={seasonForm.name_he} onChange={e => setSeason('name_he', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">שם (אנגלית)</label>
                <input type="text" dir="ltr" value={seasonForm.name_en} onChange={e => setSeason('name_en', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">מתאריך</label>
                <input type="date" value={seasonForm.start_date} onChange={e => setSeason('start_date', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">עד תאריך</label>
                <input type="date" value={seasonForm.end_date} onChange={e => setSeason('end_date', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">אחוז שינוי ברירת מחדל (%)</label>
                <input type="number" value={seasonForm.adjustment_percent} onChange={e => setSeason('adjustment_percent', Number(e.target.value))}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">עדיפות (בחפיפה, הגבוה מנצח)</label>
                <input type="number" value={seasonForm.priority} onChange={e => setSeason('priority', Number(e.target.value))}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]" />
              </div>
              <div className="col-span-2 flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={seasonForm.recurs_annually} onChange={e => setSeason('recurs_annually', e.target.checked)} className="rounded" />
                  חוזר כל שנה (רק חודש/יום נבדקים, השנה בתאריך לא משנה)
                </label>
              </div>
              <div className="col-span-2 flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={seasonForm.is_active} onChange={e => setSeason('is_active', e.target.checked)} className="rounded" />
                  פעיל
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSaveSeason}
                disabled={savingSeason || !seasonForm.name_he || !seasonForm.start_date || !seasonForm.end_date}
                className="flex-1 bg-[#E8743B] disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm"
              >
                {savingSeason ? 'שומר...' : (editSeason ? 'עדכן עונה' : 'שמור עונה')}
              </button>
              <button onClick={closeSeasonModal} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">ביטול</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-10">
        {seasons.length === 0 ? (
          <p className="text-center text-gray-400 py-12">אין עונות עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-gray-500">שם</th>
                  <th className="p-4 font-semibold text-gray-500">תאריכים</th>
                  <th className="p-4 font-semibold text-gray-500">חוזר כל שנה</th>
                  <th className="p-4 font-semibold text-gray-500">אחוז</th>
                  <th className="p-4 font-semibold text-gray-500">עדיפות</th>
                  <th className="p-4 font-semibold text-gray-500">פעיל</th>
                  <th className="p-4 font-semibold text-gray-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {seasons.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{s.nameHe}</td>
                    <td className="p-4 text-gray-600" dir="ltr">{s.startDate.slice(5)} – {s.endDate.slice(5)}</td>
                    <td className="p-4 text-gray-600">{s.recursAnnually ? 'כן' : 'לא'}</td>
                    <td className="p-4 text-gray-700 font-semibold">{s.adjustmentPercent > 0 ? '+' : ''}{s.adjustmentPercent}%</td>
                    <td className="p-4 text-gray-600">{s.priority}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.isActive ? '✅ פעיל' : '⏸ לא פעיל'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditSeason(s)} title="ערוך" className="flex items-center gap-1 bg-[#2D5F5F] hover:bg-[#1a3f3f] text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                          <Pencil className="w-3 h-3" />ערוך
                        </button>
                        <button onClick={() => handleDeleteSeason(s.id, s.nameHe)} title="מחק" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============ Vehicle overrides ============ */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">מחירים מותאמים לרכב</h2>
        <button
          onClick={openAddOverride}
          disabled={vehicles.length === 0 || seasons.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#E8743B] disabled:opacity-50 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
        >
          + הוסף התאמה אישית
        </button>
      </div>

      {(showAddOverride || editOverride !== null) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto text-right shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">{editOverride ? 'ערוך התאמה אישית' : 'הוסף התאמה אישית'}</h2>
              <button onClick={closeOverrideModal} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">רכב</label>
                <select
                  value={overrideForm.vehicle_id}
                  disabled={!!editOverride}
                  onChange={e => setOverrideForm(prev => ({ ...prev, vehicle_id: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] bg-white disabled:bg-gray-100"
                >
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} ({v.year})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">עונה</label>
                <select
                  value={overrideForm.season_id}
                  disabled={!!editOverride}
                  onChange={e => setOverrideForm(prev => ({ ...prev, season_id: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] bg-white disabled:bg-gray-100"
                >
                  {seasons.map(s => <option key={s.id} value={s.id}>{s.nameHe}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">סוג ההתאמה</label>
                <select
                  value={overrideForm.override_type}
                  onChange={e => setOverrideForm(prev => ({ ...prev, override_type: e.target.value as 'fixed' | 'percent' }))}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] bg-white"
                >
                  <option value="fixed">מחיר קבוע (₪ ליום)</option>
                  <option value="percent">אחוז שינוי מהמחיר הרגיל (%)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">{overrideForm.override_type === 'fixed' ? 'מחיר ליום (₪)' : 'אחוז (%)'}</label>
                <input type="number" value={overrideForm.value} onChange={e => setOverrideForm(prev => ({ ...prev, value: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]" />
              </div>
            </div>

            {overrideError && <p className="text-sm text-red-600 mt-3">{overrideError}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSaveOverride}
                disabled={savingOverride || !overrideForm.vehicle_id || !overrideForm.season_id || overrideForm.value === ''}
                className="flex-1 bg-[#E8743B] disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm"
              >
                {savingOverride ? 'שומר...' : (editOverride ? 'עדכן התאמה' : 'שמור התאמה')}
              </button>
              <button onClick={closeOverrideModal} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">ביטול</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {overrides.length === 0 ? (
          <p className="text-center text-gray-400 py-12">אין התאמות אישיות עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-gray-500">רכב</th>
                  <th className="p-4 font-semibold text-gray-500">עונה</th>
                  <th className="p-4 font-semibold text-gray-500">התאמה</th>
                  <th className="p-4 font-semibold text-gray-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {overrides.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{vehicleLabel(o.vehicleId)}</td>
                    <td className="p-4 text-gray-600">{seasonLabel(o.seasonId)}</td>
                    <td className="p-4 text-gray-700 font-semibold">
                      {o.fixedPrice != null ? `₪${o.fixedPrice}/יום` : `${o.adjustmentPercent! > 0 ? '+' : ''}${o.adjustmentPercent}%`}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditOverride(o)} title="ערוך" className="flex items-center gap-1 bg-[#2D5F5F] hover:bg-[#1a3f3f] text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                          <Pencil className="w-3 h-3" />ערוך
                        </button>
                        <button onClick={() => handleDeleteOverride(o.id)} title="מחק" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
