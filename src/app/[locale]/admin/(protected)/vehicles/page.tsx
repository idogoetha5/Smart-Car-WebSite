'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, X } from 'lucide-react';

const CATEGORIES = ['MINI', 'ECONOMY', 'COMPACT', 'SEDAN', 'CROSSOVER', 'SUV', 'LUXURY', 'VAN', 'COMMERCIAL', 'ELECTRIC'];
const FUEL_TYPES = ['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID'];
const TRANSMISSIONS = ['AUTOMATIC', 'MANUAL'];
const COLORS_HE = ['לבן', 'שחור', 'אפור', 'כסף', 'כחול', 'אדום', 'ירוק', 'חום'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Vehicle = any;

const EMPTY_VEHICLE = {
  make: '', model: '', year: new Date().getFullYear(),
  category: 'ECONOMY', color_he: 'לבן', color_en: '', price_per_day: 150,
  fuel_type: 'GASOLINE', transmission: 'AUTOMATIC',
  seats: 5, doors: 4, is_available: true, is_featured: false,
  image_urls: [] as string[],
  price_per_month: 2000, deposit_amount: 1500, total_units: 1,
  description_he: '', description_en: '',
};

type VehicleForm = typeof EMPTY_VEHICLE;

interface FieldDef { label: string; key: keyof VehicleForm; type: string; placeholder: string }
interface SelectDef { label: string; key: keyof VehicleForm; options: string[] }

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>({ ...EMPTY_VEHICLE });
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/vehicles');
      if (res.status === 401) { router.push('/he/admin/login'); return; }
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch {
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const openEdit = (v: Vehicle) => {
    setEditVehicle(v);
    setForm({
      make: v.make ?? '',
      model: v.model ?? '',
      year: v.year ?? new Date().getFullYear(),
      category: v.category ?? 'ECONOMY',
      color_he: v.color_he ?? 'לבן',
      color_en: v.color_en ?? '',
      price_per_day: v.price_per_day ?? 150,
      fuel_type: v.fuel_type ?? 'GASOLINE',
      transmission: v.transmission ?? 'AUTOMATIC',
      seats: v.seats ?? 5,
      doors: v.doors ?? 4,
      is_available: v.is_available ?? true,
      is_featured: v.is_featured ?? false,
      image_urls: v.image_urls ?? [],
      price_per_month: v.price_per_month ?? 2000,
      deposit_amount: v.deposit_amount ?? 1500,
      total_units: v.total_units ?? 1,
      description_he: v.description_he ?? '',
      description_en: v.description_en ?? '',
    });
    setImageUrl((v.image_urls ?? [])[0] ?? '');
    setShowAddForm(false);
  };

  const openAdd = () => {
    setEditVehicle(null);
    setForm({ ...EMPTY_VEHICLE });
    setImageUrl('');
    setShowAddForm(true);
  };

  const closeModal = () => { setShowAddForm(false); setEditVehicle(null); };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`למחוק את ${name}?`)) return;
    await fetch(`/api/admin/vehicles/${id}`, { method: 'DELETE' });
    fetchVehicles();
  };

  const handleToggle = async (id: string, current: boolean) => {
    await fetch(`/api/admin/vehicles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: !current }),
    });
    fetchVehicles();
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, image_urls: imageUrl ? [imageUrl] : form.image_urls };
    if (editVehicle) {
      await fetch(`/api/admin/vehicles/${editVehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    closeModal();
    fetchVehicles();
  };

  const set = (key: keyof VehicleForm, value: string | number | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const isOpen = showAddForm || editVehicle !== null;

  const textFields: FieldDef[] = [
    { label: 'יצרן', key: 'make', type: 'text', placeholder: 'Kia' },
    { label: 'דגם', key: 'model', type: 'text', placeholder: 'Picanto' },
    { label: 'שנה', key: 'year', type: 'number', placeholder: '2024' },
    { label: 'מחיר ליום ₪', key: 'price_per_day', type: 'number', placeholder: '150' },
    { label: 'מחיר לחודש ₪', key: 'price_per_month', type: 'number', placeholder: '2000' },
    { label: 'פיקדון ₪', key: 'deposit_amount', type: 'number', placeholder: '1500' },
    { label: 'מושבים', key: 'seats', type: 'number', placeholder: '5' },
    { label: 'דלתות', key: 'doors', type: 'number', placeholder: '4' },
    { label: 'יחידות', key: 'total_units', type: 'number', placeholder: '1' },
    { label: 'צבע (EN)', key: 'color_en', type: 'text', placeholder: 'White' },
  ];

  const selectFields: SelectDef[] = [
    { label: 'קטגוריה', key: 'category', options: CATEGORIES },
    { label: 'סוג דלק', key: 'fuel_type', options: FUEL_TYPES },
    { label: 'הילוכים', key: 'transmission', options: TRANSMISSIONS },
    { label: 'צבע (HE)', key: 'color_he', options: COLORS_HE },
  ];

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-200 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="p-8" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900">ניהול רכבים</h1>
          <p className="text-gray-500 mt-1">{vehicles.length} רכבים</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#E8743B] text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
        >
          + הוסף רכב
        </button>
      </div>

      {/* Add / Edit Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto text-right shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">
                {editVehicle ? `ערוך — ${editVehicle.make} ${editVehicle.model}` : 'הוסף רכב חדש'}
              </h2>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Text / number fields */}
              {textFields.map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-600 block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key] as string | number}
                    onChange={e => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                  />
                </div>
              ))}

              {/* Select fields */}
              {selectFields.map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-600 block mb-1">{f.label}</label>
                  <select
                    value={form[f.key] as string}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] bg-white"
                  >
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}

              {/* Image URL */}
              <div className="col-span-2">
                <label className="text-xs text-gray-600 block mb-1">קישור לתמונה</label>
                <input
                  type="text"
                  placeholder="/images/vehicles/car.jpg"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                />
              </div>

              {/* Description HE */}
              <div className="col-span-2">
                <label className="text-xs text-gray-600 block mb-1">תיאור (עברית)</label>
                <textarea
                  rows={2}
                  value={form.description_he}
                  onChange={e => set('description_he', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] resize-none"
                />
              </div>

              {/* Description EN */}
              <div className="col-span-2">
                <label className="text-xs text-gray-600 block mb-1">תיאור (אנגלית)</label>
                <textarea
                  rows={2}
                  value={form.description_en}
                  onChange={e => set('description_en', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] resize-none"
                  dir="ltr"
                />
              </div>

              {/* Checkboxes */}
              <div className="col-span-2 flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={e => set('is_featured', e.target.checked)}
                    className="rounded"
                  />
                  מומלץ (דף הבית)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_available}
                    onChange={e => set('is_available', e.target.checked)}
                    className="rounded"
                  />
                  פנוי להשכרה
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving || !form.make || !form.model}
                className="flex-1 bg-[#E8743B] disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm"
              >
                {saving ? 'שומר...' : (editVehicle ? 'עדכן רכב' : 'שמור רכב')}
              </button>
              <button
                onClick={closeModal}
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="חיפוש לפי מותג..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-72 p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] text-right"
        />
      </div>

      {/* Table */}
      {(() => {
        const filtered = vehicles.filter(v => v.make?.toLowerCase().includes(search.toLowerCase()));
        return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12">
            {vehicles.length === 0 ? 'אין רכבים עדיין' : 'לא נמצאו תוצאות'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold text-gray-500">רכב</th>
                  <th className="p-4 font-semibold text-gray-500">קטגוריה</th>
                  <th className="p-4 font-semibold text-gray-500">צבע</th>
                  <th className="p-4 font-semibold text-gray-500">מחיר/יום</th>
                  <th className="p-4 font-semibold text-gray-500">סטטוס</th>
                  <th className="p-4 font-semibold text-gray-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{v.make} {v.model} <span className="text-xs text-gray-400 font-normal">{v.year}</span></td>
                    <td className="p-4 text-gray-600">{v.category}</td>
                    <td className="p-4 text-gray-600">{v.color_he || v.color || '—'}</td>
                    <td className="p-4 text-gray-700 font-semibold">₪{v.price_per_day}</td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggle(v.id, v.is_available)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          v.is_available
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {v.is_available ? '✅ פנוי' : '❌ תפוס'}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(v)}
                          title="ערוך"
                          className="flex items-center gap-1 bg-[#2D5F5F] hover:bg-[#1a3f3f] text-white px-3 py-1.5 rounded-lg text-xs transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, `${v.make} ${v.model}`)}
                          title="מחק"
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
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
        );
      })()}
    </div>
  );
}
