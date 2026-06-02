'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, AlertTriangle } from 'lucide-react';

const DAMAGE_AREAS = [
  { id: 'front',       heLabel: 'חזית',           enLabel: 'Front' },
  { id: 'rear',        heLabel: 'אחור',            enLabel: 'Rear' },
  { id: 'left_side',   heLabel: 'צד שמאל',         enLabel: 'Left Side' },
  { id: 'right_side',  heLabel: 'צד ימין',          enLabel: 'Right Side' },
  { id: 'roof',        heLabel: 'גג',              enLabel: 'Roof' },
  { id: 'windshield',  heLabel: 'שמשה קדמית',       enLabel: 'Windshield' },
  { id: 'windows',     heLabel: 'חלונות צד',        enLabel: 'Side Windows' },
  { id: 'interior',    heLabel: 'פנים הרכב',        enLabel: 'Interior' },
  { id: 'tires',       heLabel: 'צמיגים וגלגלים',   enLabel: 'Tires & Wheels' },
  { id: 'engine',      heLabel: 'תא מנוע',          enLabel: 'Engine Bay' },
];

export default function ConditionReportPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';

  const [bookingId, setBookingId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [fuelLevel, setFuelLevel] = useState('full');
  const [mileage, setMileage] = useState('');
  const [damages, setDamages] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleDamage = (id: string) =>
    setDamages(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isHe ? 'דוח מצב נשמר בהצלחה' : 'Condition report saved successfully'}
        </h2>
        <p className="text-gray-500">
          {isHe
            ? 'תודה. הדוח הועבר לצוות SmartCar לבדיקה.'
            : 'Thank you. The report has been forwarded to the SmartCar team.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 mb-1">
          {isHe ? 'דוח מצב רכב' : 'Vehicle Condition Report'}
        </h1>
        <p className="text-gray-500 text-sm">
          {isHe
            ? 'מלא את הטופס בעת קבלת/החזרת הרכב'
            : 'Complete this form when receiving or returning the vehicle'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Booking info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-800">
            {isHe ? 'פרטי ההזמנה' : 'Booking Details'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isHe ? 'מספר הזמנה' : 'Booking ID'}
              </label>
              <input
                type="text"
                value={bookingId}
                onChange={e => setBookingId(e.target.value.toUpperCase())}
                placeholder="ABC12345"
                className="w-full h-10 border-2 border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#2D5F5F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isHe ? 'שם הלקוח' : 'Customer Name'}
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full h-10 border-2 border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#2D5F5F]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isHe ? 'קריאת מד אוץ (ק"מ)' : 'Odometer Reading (km)'}
              </label>
              <input
                type="number"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                placeholder="0"
                className="w-full h-10 border-2 border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#2D5F5F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isHe ? 'רמת דלק' : 'Fuel Level'}
              </label>
              <select
                value={fuelLevel}
                onChange={e => setFuelLevel(e.target.value)}
                className="w-full h-10 border-2 border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-[#2D5F5F]"
              >
                <option value="full">{isHe ? 'מלא' : 'Full'}</option>
                <option value="3/4">{isHe ? '¾' : '¾'}</option>
                <option value="1/2">{isHe ? '½' : '½'}</option>
                <option value="1/4">{isHe ? '¼' : '¼'}</option>
                <option value="empty">{isHe ? 'ריק' : 'Empty'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Damage checklist */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {isHe ? 'סמן אזורים עם נזק / שריטות' : 'Mark damaged / scratched areas'}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {DAMAGE_AREAS.map(area => (
              <label
                key={area.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                  damages[area.id]
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!damages[area.id]}
                  onChange={() => toggleDamage(area.id)}
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-sm font-medium">
                  {isHe ? area.heLabel : area.enLabel}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <label className="block font-bold text-gray-800 mb-2">
            {isHe ? 'הערות נוספות' : 'Additional Notes'}
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder={isHe ? 'תאר כל נזק, בעיה או הערה...' : 'Describe any damage, issues, or notes...'}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D5F5F] resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !customerName}
          className="w-full py-3 bg-[#2D5F5F] hover:bg-[#1A3A3A] disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
        >
          {loading ? (isHe ? 'שולח...' : 'Submitting...') : (isHe ? 'שלח דוח מצב' : 'Submit Condition Report')}
        </button>
      </form>
    </div>
  );
}
