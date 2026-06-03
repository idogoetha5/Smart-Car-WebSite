'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { Plus, Trash2, Car } from 'lucide-react';

interface CarForSale {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  km: number | null;
  color: string | null;
  extras: string | null;
  image_url: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  make: '',
  model: '',
  year: '',
  price: '',
  km: '',
  color: '',
  extras: '',
  image_url: '',
};

export default function AdminCarsForSalePage() {
  const locale = useLocale();
  const isHe = locale === 'he';

  const [cars, setCars] = useState<CarForSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchCars = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cars-for-sale');
      const json = await res.json();
      setCars(json.data ?? []);
    } catch {
      setError(isHe ? 'שגיאה בטעינה' : 'Load error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCars(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cars-for-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? 'Failed');
      }
      setSuccess(isHe ? 'רכב נוסף בהצלחה!' : 'Car added!');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await fetchCars();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isHe ? 'האם למחוק?' : 'Confirm delete?')) return;
    try {
      const res = await fetch(`/api/admin/cars-for-sale/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setCars(prev => prev.filter(c => c.id !== id));
    } catch {
      setError(isHe ? 'שגיאה במחיקה' : 'Delete error');
    }
  };

  const fields = [
    { key: 'make',      label: isHe ? 'יצרן' : 'Make',      required: true,  type: 'text' },
    { key: 'model',     label: isHe ? 'דגם' : 'Model',      required: true,  type: 'text' },
    { key: 'year',      label: isHe ? 'שנה' : 'Year',       required: true,  type: 'number' },
    { key: 'price',     label: isHe ? 'מחיר (₪)' : 'Price (₪)', required: true,  type: 'number' },
    { key: 'km',        label: isHe ? 'ק"מ' : 'KM',          required: false, type: 'number' },
    { key: 'color',     label: isHe ? 'צבע' : 'Color',       required: false, type: 'text' },
    { key: 'image_url', label: isHe ? 'קישור תמונה' : 'Image URL', required: false, type: 'url' },
  ];

  return (
    <div className="p-8" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <Car className="w-8 h-8 text-[#E8743B]" />
            {isHe ? 'ניהול רכבים למכירה' : 'Manage Cars for Sale'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isHe ? `${cars.length} רכבים פעילים` : `${cars.length} active listings`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#E8743B] text-white font-bold rounded-xl hover:bg-[#d4622a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          {isHe ? 'הוסף רכב' : 'Add Car'}
        </button>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 font-medium">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          ❌ {error}
        </div>
      )}

      {showForm && (
        <div className="mb-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">
            {isHe ? 'הוסף רכב למכירה' : 'Add Car for Sale'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    required={f.required}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isHe ? 'תיאור / תוספות' : 'Description / Extras'}
              </label>
              <textarea
                value={form.extras}
                onChange={e => setForm(prev => ({ ...prev, extras: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#2D5F5F] text-white font-bold rounded-xl hover:bg-[#1A3A3A] transition-colors disabled:opacity-60"
              >
                {saving ? '...' : (isHe ? 'שמור' : 'Save')}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(''); }}
                className="px-6 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                {isHe ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-48 animate-pulse" />
          ))}
        </div>
      ) : cars.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-6xl mb-4">🚗</span>
          <p className="text-gray-400 text-lg">{isHe ? 'אין רכבים למכירה' : 'No cars listed'}</p>
          <p className="text-gray-300 mt-1">{isHe ? 'לחץ "הוסף רכב" כדי להתחיל' : 'Click "Add Car" to get started'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cars.map(car => (
            <div key={car.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {car.image_url ? (
                <div className="relative w-full h-40">
                  <Image src={car.image_url} alt={`${car.make} ${car.model}`} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" unoptimized />
                </div>
              ) : (
                <div className="w-full h-40 bg-[#eef6f6] flex items-center justify-center">
                  <Car className="w-12 h-12 text-[#2D5F5F] opacity-40" />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-900">
                  {car.year} {car.make} {car.model}
                </h3>
                <div className="flex flex-wrap gap-2 mt-2 mb-3 text-sm text-gray-500">
                  <span className="font-bold text-[#2D5F5F] text-base">₪{car.price.toLocaleString()}</span>
                  {car.km !== null && <span>🛣️ {car.km.toLocaleString()} {isHe ? 'ק"מ' : 'km'}</span>}
                  {car.color && <span>🎨 {car.color}</span>}
                </div>
                {car.extras && <p className="text-xs text-gray-400 mb-3 line-clamp-2">{car.extras}</p>}
                <button
                  onClick={() => handleDelete(car.id)}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  {isHe ? 'מחק' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
