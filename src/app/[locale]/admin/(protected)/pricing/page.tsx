'use client';

import { useMemo, useRef, useState } from 'react';
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

type SeasonEditType = 'default' | 'fixed' | 'percent';
type SeasonEdit = { type: SeasonEditType; value: string };

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

  // ---------------- Overrides — search a vehicle, edit every season for it in one place ----------------
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [seasonEdits, setSeasonEdits] = useState<Record<string, SeasonEdit>>({});
  const [savingSeasonId, setSavingSeasonId] = useState<string | null>(null);
  const [seasonEditError, setSeasonEditError] = useState('');
  const vehiclePanelRef = useRef<HTMLDivElement>(null);

  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(v => `${v.make} ${v.model} ${v.year} ${v.license_plate ?? ''}`.toLowerCase().includes(q));
  }, [vehicles, vehicleQuery]);

  const buildSeasonEdits = (vehicleId: string): Record<string, SeasonEdit> => {
    const map: Record<string, SeasonEdit> = {};
    for (const s of seasons) {
      const o = overrides.find(o => o.vehicleId === vehicleId && o.seasonId === s.id);
      if (o?.fixedPrice != null) map[s.id] = { type: 'fixed', value: String(o.fixedPrice) };
      else if (o?.adjustmentPercent != null) map[s.id] = { type: 'percent', value: String(o.adjustmentPercent) };
      else map[s.id] = { type: 'default', value: '' };
    }
    return map;
  };

  const selectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setSeasonEdits(buildSeasonEdits(vehicleId));
    setVehicleQuery('');
    setVehiclePickerOpen(false);
    setSeasonEditError('');
  };

  const clearVehicleSelection = () => {
    setSelectedVehicleId('');
    setSeasonEdits({});
    setSeasonEditError('');
  };

  const handleSaveSeasonOverride = async (seasonId: string) => {
    const edit = seasonEdits[seasonId];
    const existing = overrides.find(o => o.vehicleId === selectedVehicleId && o.seasonId === seasonId);
    if (edit.type === 'default' && !existing) return; // already at the season default, nothing to save

    setSeasonEditError('');
    setSavingSeasonId(seasonId);
    const res = edit.type === 'default'
      ? await fetch(`/api/admin/pricing-overrides/${existing!.id}`, { method: 'DELETE' })
      : existing
        ? await fetch(`/api/admin/pricing-overrides/${existing.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fixed_price: edit.type === 'fixed' ? Number(edit.value) : null,
              adjustment_percent: edit.type === 'percent' ? Number(edit.value) : null,
            }),
          })
        : await fetch('/api/admin/pricing-overrides', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vehicle_id: selectedVehicleId, season_id: seasonId,
              fixed_price: edit.type === 'fixed' ? Number(edit.value) : null,
              adjustment_percent: edit.type === 'percent' ? Number(edit.value) : null,
            }),
          });
    setSavingSeasonId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSeasonEditError(body.error || 'שגיאת שרת, נסה שוב');
      return;
    }
    refetchOverrides();
  };

  const handleDeleteOverride = async (o: VehiclePriceOverride) => {
    if (!window.confirm('למחוק את ההתאמה האישית? הרכב יחזור למחיר ברירת המחדל של העונה.')) return;
    await fetch(`/api/admin/pricing-overrides/${o.id}`, { method: 'DELETE' });
    refetchOverrides();
    if (selectedVehicleId === o.vehicleId) {
      setSeasonEdits(prev => ({ ...prev, [o.seasonId]: { type: 'default', value: '' } }));
    }
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
      <div className="mb-4" ref={vehiclePanelRef}>
        <h2 className="text-xl font-bold text-gray-900 mb-3">מחירים מותאמים לרכב</h2>
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="חפש רכב לפי יצרן, דגם או מספר רכב..."
            value={vehicleQuery}
            onFocus={() => setVehiclePickerOpen(true)}
            onChange={e => { setVehicleQuery(e.target.value); setVehiclePickerOpen(true); }}
            onBlur={() => setTimeout(() => setVehiclePickerOpen(false), 150)}
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
          />
          {vehiclePickerOpen && (
            <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
              {filteredVehicles.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-3">לא נמצאו רכבים</p>
              ) : filteredVehicles.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectVehicle(v.id)}
                  className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  {v.make} {v.model} ({v.year})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedVehicleId && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{vehicleLabel(selectedVehicleId)}</h3>
            <button onClick={clearVehicleSelection} className="text-sm text-gray-400 hover:text-gray-700">נקה בחירה ✕</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-3 font-semibold text-gray-500">עונה</th>
                  <th className="p-3 font-semibold text-gray-500">סוג</th>
                  <th className="p-3 font-semibold text-gray-500">ערך</th>
                  <th className="p-3 font-semibold text-gray-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {seasons.map(s => {
                  const edit = seasonEdits[s.id] ?? { type: 'default' as const, value: '' };
                  return (
                    <tr key={s.id}>
                      <td className="p-3 font-medium text-gray-900">
                        {s.nameHe}
                        <span className="text-xs text-gray-400 block font-normal">ברירת מחדל: {s.adjustmentPercent > 0 ? '+' : ''}{s.adjustmentPercent}%</span>
                      </td>
                      <td className="p-3">
                        <select
                          value={edit.type}
                          onChange={e => {
                            const type = e.target.value as SeasonEditType;
                            setSeasonEdits(prev => ({ ...prev, [s.id]: { type, value: type === 'default' ? '' : prev[s.id]?.value ?? '' } }));
                          }}
                          className="p-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                        >
                          <option value="default">ברירת מחדל</option>
                          <option value="fixed">מחיר קבוע</option>
                          <option value="percent">אחוז מותאם</option>
                        </select>
                      </td>
                      <td className="p-3">
                        {edit.type !== 'default' && (
                          <input
                            type="number"
                            value={edit.value}
                            onChange={e => setSeasonEdits(prev => ({ ...prev, [s.id]: { ...edit, value: e.target.value } }))}
                            placeholder={edit.type === 'fixed' ? '₪ ליום' : '%'}
                            className="w-24 p-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                          />
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleSaveSeasonOverride(s.id)}
                          disabled={savingSeasonId === s.id || (edit.type !== 'default' && edit.value === '')}
                          className="bg-[#E8743B] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors"
                        >
                          {savingSeasonId === s.id ? 'שומר...' : 'שמור'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {seasonEditError && <p className="text-sm text-red-600 mt-3">{seasonEditError}</p>}
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
                        <button
                          onClick={() => { selectVehicle(o.vehicleId); vehiclePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                          title="ערוך"
                          className="flex items-center gap-1 bg-[#2D5F5F] hover:bg-[#1a3f3f] text-white px-3 py-1.5 rounded-lg text-xs transition-colors"
                        >
                          <Pencil className="w-3 h-3" />ערוך
                        </button>
                        <button onClick={() => handleDeleteOverride(o)} title="מחק" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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
