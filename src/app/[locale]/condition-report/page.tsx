'use client';

import { useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import TurnstileWidget from '@/components/ui/Turnstile';
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

function ConditionReportForm() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';

  const [customerName, setCustomerName] = useState('');
  const [fuelLevel, setFuelLevel] = useState('full');
  const [mileage, setMileage] = useState('');
  const [damages, setDamages] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState('');
  const [officeNotified, setOfficeNotified] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [website, setWebsite] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  // The booking is carried by the signed link the office sent, not typed
  // by the customer — the API derives it from the token and ignores any
  // booking id in the body.
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  // Display only. The server re-derives this from the token's signature —
  // nothing here is trusted, so reading it without verifying is fine.
  const linkedBookingId = token.split('.')[0] ?? '';

  const toggleDamage = (id: string) =>
    setDamages(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/condition-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, customerName, mileage, fuelLevel, damages, notes, turnstileToken, _website: website }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || (isHe ? 'שמירת הדוח נכשלה. נסה שוב.' : 'Failed to save the report. Please try again.'));
        return;
      }
      setReportId(json.data?.id ?? '');
      setOfficeNotified(json.officeNotified !== false);
      setSubmitted(true);
    } catch {
      setError(isHe ? 'שמירת הדוח נכשלה. נסה שוב.' : 'Failed to save the report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reached without a signed link. Say so plainly rather than showing a
  // form that can never submit.
  if (!token) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isHe ? 'נדרש קישור אישי' : 'A personal link is required'}
        </h1>
        <p className="text-gray-600">
          {isHe
            ? 'דוח מצב רכב ניתן למלא רק דרך הקישור שנשלח אליכם מהמשרד עבור ההזמנה שלכם. אם אין לכם קישור, צרו איתנו קשר ונשלח אותו.'
            : 'A condition report can only be filed through the link the office sent you for your booking. If you do not have one, contact us and we will send it.'}
        </p>
        <a
          href={`/${locale}/contact`}
          className="inline-block mt-6 px-6 py-3 bg-[#2D5F5F] hover:bg-[#1A3A3A] text-white font-bold rounded-xl transition-colors"
        >
          {isHe ? 'צרו קשר' : 'Contact us'}
        </a>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isHe ? 'דוח מצב נשמר בהצלחה' : 'Condition report saved successfully'}
        </h2>
        <p className="text-gray-600">
          {officeNotified
            ? (isHe
                ? 'תודה. הדוח הועבר לצוות SmartCar לבדיקה.'
                : 'Thank you. The report has been forwarded to the SmartCar team.')
            : (isHe
                ? 'הדוח נשמר במערכת. אם לא תקבלו אישור מהצוות בהקדם, אנא צרו קשר וציינו את מספר האסמכתא.'
                : "The report has been saved. If you don't hear from our team soon, please contact us and mention the reference ID.")}
        </p>
        {reportId && (
          <p className="text-gray-400 text-xs mt-3">
            {isHe ? 'מספר אסמכתא: ' : 'Reference ID: '}{reportId}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 mb-1">
          {isHe ? 'דוח מצב רכב' : 'Vehicle Condition Report'}
        </h1>
        <p className="text-gray-600 text-sm">
          {isHe
            ? 'מלא את הטופס בעת קבלת/החזרת הרכב'
            : 'Complete this form when receiving or returning the vehicle'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Honeypot */}
        <input
          type="text"
          name="_website"
          value={website}
          onChange={e => setWebsite(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />

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
              {/* Read-only: the booking comes from the signed link, so it
                  cannot be edited to point at someone else's booking. */}
              <input
                type="text"
                readOnly
                aria-label={isHe ? 'מספר הזמנה' : 'Booking ID'}
                aria-describedby="booking-id-hint"
                value={linkedBookingId}
                className="w-full h-10 border-2 border-gray-200 bg-gray-50 text-gray-700 rounded-xl px-3 text-sm focus:outline-none"
              />
              <p id="booking-id-hint" className="text-xs text-gray-500 mt-1">
                {isHe
                  ? 'מזוהה אוטומטית מהקישור שנשלח אליכם'
                  : 'Identified automatically from the link sent to you'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isHe ? 'שם הלקוח' : 'Customer Name'}
              </label>
              <input
                type="text"
                required
                aria-label={isHe ? 'שם הלקוח' : 'Customer Name'}
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full h-10 border-2 border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#2D5F5F]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isHe ? 'קריאת קילומטראז\' (ק"מ)' : 'Odometer Reading (km)'}
              </label>
              <input
                type="number"
                aria-label={isHe ? 'קריאת קילומטראז\' (ק"מ)' : 'Odometer Reading (km)'}
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
                aria-label={isHe ? 'רמת דלק' : 'Fuel Level'}
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
            aria-label={isHe ? 'הערות נוספות' : 'Additional Notes'}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder={isHe ? 'תאר כל נזק, בעיה או הערה...' : 'Describe any damage, issues, or notes...'}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D5F5F] resize-none"
          />
        </div>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <TurnstileWidget onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

        <button
          type="submit"
          disabled={loading || !customerName || !token || !turnstileToken}
          className="w-full py-3 bg-[#2D5F5F] hover:bg-[#1A3A3A] disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
        >
          {loading ? (isHe ? 'שולח...' : 'Submitting...') : (isHe ? 'שלח דוח מצב' : 'Submit Condition Report')}
        </button>
      </form>
    </div>
  );
}

/**
 * useSearchParams opts a route into client-side rendering, which Next.js
 * requires to sit behind a Suspense boundary or prerendering fails. The
 * fallback is deliberately minimal — the token is read on the client, so
 * there is nothing meaningful to show until it is available.
 */
export default function ConditionReportPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-20" aria-busy="true" />}>
      <ConditionReportForm />
    </Suspense>
  );
}
