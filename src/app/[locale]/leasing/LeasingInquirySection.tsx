'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import Image from 'next/image';
import { Phone, Mail, Users, Settings, Fuel, Send, CheckCircle } from 'lucide-react';
import type { Vehicle } from '@/types';
import TurnstileWidget from '@/components/ui/Turnstile';
import { LEASING_BASE_PRICE as BASE_LEASING_PRICE, LEASING_MILEAGE_MULTIPLIER as MILEAGE_MULTIPLIER, LEASING_DURATION_DISCOUNT as DURATION_DISCOUNT } from '@/lib/pricing';

const MILEAGE_OPTIONS = [
  { value: '10000', labelHe: '10,000 ק"מ/שנה', labelEn: '10,000 km/year' },
  { value: '15000', labelHe: '15,000 ק"מ/שנה', labelEn: '15,000 km/year' },
  { value: '20000', labelHe: '20,000 ק"מ/שנה', labelEn: '20,000 km/year' },
  { value: 'unlimited', labelHe: 'ללא הגבלה', labelEn: 'Unlimited' },
];

function InquiryContent({ vehicles, locale }: { vehicles: Vehicle[]; locale: string }) {
  const searchParams = useSearchParams();
  const isHe = locale === 'he';
  const sectionRef = useRef<HTMLDivElement>(null);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleLockedFromUrl, setVehicleLockedFromUrl] = useState(false);
  const [duration, setDuration] = useState(36);
  const [mileage, setMileage] = useState('15000');

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formSending, setFormSending] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [formError, setFormError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    const vehicleId = searchParams.get('vehicle');
    if (vehicleId && vehicles.length > 0) {
      let found = vehicles.find(v => v.id === vehicleId);
      if (!found) {
        // ID from catalog may differ from deduplicated leasing list — fall back to make/model
        const make = searchParams.get('make');
        const model = searchParams.get('model');
        if (make && model) {
          found = vehicles.find(v => v.make === make && v.model === model);
        }
      }
      if (found) {
        setSelectedVehicle(found);
        setVehicleLockedFromUrl(true);
      }
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [searchParams, vehicles]);

  const monthlyPrice = selectedVehicle
    ? Math.round(
        (BASE_LEASING_PRICE[selectedVehicle.category] ?? 3500) *
        (MILEAGE_MULTIPLIER[mileage] ?? 1) *
        (DURATION_DISCOUNT[duration] ?? 1)
      )
    : 0;

  const handleWhatsApp = () => {
    if (!selectedVehicle) return;
    const phone = '97299509757';
    const mileageLabel = mileage === 'unlimited'
      ? 'ללא הגבלה'
      : `${Number(mileage).toLocaleString()} ק״מ לשנה`;
    const msg = `היי! אני מעוניין בליסינג על ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}\n\nפרטי הבקשה:\n🚗 רכב: ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}\n📅 משך חוזה: ${duration} חודשים\n📍 קילומטרז׳: ${mileageLabel}\n💰 מחיר חודשי משוער: ₪${monthlyPrice.toLocaleString()}\n\nאשמח לקבל פרטים נוספים, תודה!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;
    setFormSending(true);
    setFormError('');
    try {
      const res = await fetch('/api/leasing/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: formName.trim(),
          customer_phone: formPhone.trim(),
          customer_email: formEmail.trim() || null,
          vehicle_id: selectedVehicle?.id ?? null,
          notes: formMessage.trim() || null,
          duration_months: duration,
          mileage_package: mileage === 'unlimited' ? 0 : Number(mileage),
          estimated_monthly: monthlyPrice,
          turnstileToken,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || (isHe ? 'שגיאה, נסה שנית' : 'Error, please try again'));
      } else {
        setFormSent(true);
        setFormName(''); setFormPhone(''); setFormEmail(''); setFormMessage(''); setTurnstileToken(null);
        setShowForm(false);
      }
    } catch {
      setFormError(isHe ? 'שגיאה, נסה שנית' : 'Error, please try again');
    } finally {
      setFormSending(false);
    }
  };

  return (
    <section id="calculator" ref={sectionRef} className="py-16 bg-white scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mb-8 ${isHe ? 'text-right' : 'text-left'}`}>
          <p className="text-[#E8743B] text-sm font-semibold uppercase tracking-widest mb-2">
            {isHe ? 'קבל הצעת מחיר מיידית' : 'Get an Instant Quote'}
          </p>
          <h2 className="text-3xl font-black text-[#0D2B2B]">
            {isHe ? 'מחשבון ליסינג' : 'Leasing Calculator'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEFT: Controls */}
          <div className="space-y-6">
            {/* Vehicle selector */}
            <div className={isHe ? 'text-right' : 'text-left'}>
              <label className="block font-semibold text-[#0D2B2B] mb-2">
                {isHe ? 'בחר רכב' : 'Select Vehicle'}
              </label>
              {vehicleLockedFromUrl && selectedVehicle ? (
                <div className="w-full p-3 border-2 border-[#2D5F5F] rounded-xl bg-[#eef6f6] text-gray-900 font-medium flex items-center justify-between">
                  <span>{selectedVehicle.make} {selectedVehicle.model}</span>
                  <button
                    type="button"
                    onClick={() => setVehicleLockedFromUrl(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline ms-2 shrink-0"
                  >
                    {isHe ? 'שנה' : 'Change'}
                  </button>
                </div>
              ) : (
                <select
                  value={selectedVehicle?.id ?? ''}
                  onChange={(e) => {
                    const found = vehicles.find(v => v.id === e.target.value) ?? null;
                    setSelectedVehicle(found);
                  }}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#2D5F5F] outline-none bg-white text-gray-900"
                  dir={isHe ? 'rtl' : 'ltr'}
                >
                  <option value="">{isHe ? '-- בחר רכב --' : '-- Select vehicle --'}</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.year} {v.make} {v.model}
                      {(v.colorHe || v.colorEn) ? ` – ${isHe ? v.colorHe : v.colorEn}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedVehicle && (
              <div className="border-2 border-[#2D5F5F] rounded-xl overflow-hidden">
                {selectedVehicle.imageUrls?.[0] && (
                  <div className="relative h-40 w-full">
                    <Image
                      src={selectedVehicle.imageUrls[0]}
                      alt={`${selectedVehicle.make} ${selectedVehicle.model}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className={`p-3 bg-[#eef6f6] ${isHe ? 'text-right' : 'text-left'}`}>
                  <p className="font-bold text-[#0D2B2B]">
                    {selectedVehicle.make} {selectedVehicle.model}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedVehicle.seats}</span>
                    <span className="flex items-center gap-1"><Settings className="w-3 h-3" />{selectedVehicle.transmission === 'AUTOMATIC' ? (isHe ? 'אוטומטי' : 'Auto') : (isHe ? 'ידני' : 'Manual')}</span>
                    <span className="flex items-center gap-1"><Fuel className="w-3 h-3" />{selectedVehicle.fuelType}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Duration */}
            <div className={isHe ? 'text-right' : 'text-left'}>
              <label className="block font-semibold text-[#0D2B2B] mb-2">
                {isHe ? 'משך חוזה:' : 'Contract duration:'}{' '}
                <span className="text-[#E8743B] font-bold">{duration} {isHe ? 'חודשים' : 'months'}</span>
              </label>
              <input
                type="range" min={12} max={60} step={6} value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full h-2 accent-[#E8743B]"
                dir={isHe ? 'rtl' : 'ltr'}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>12 {isHe ? 'חודש' : 'mo'}</span>
                <span>60 {isHe ? 'חודש' : 'mo'}</span>
              </div>
            </div>

            {/* Mileage */}
            <div className={isHe ? 'text-right' : 'text-left'}>
              <label className="block font-semibold text-[#0D2B2B] mb-2">
                {isHe ? 'חבילת קילומטרז׳' : 'Mileage package'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MILEAGE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setMileage(opt.value)}
                    className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${mileage === opt.value ? 'border-[#E8743B] bg-orange-50 text-[#E8743B] font-bold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {isHe ? opt.labelHe : opt.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Price + actions */}
          <div className="bg-[#0D2B2B] text-white rounded-2xl p-8 flex flex-col justify-between">
            <div>
              <h3 className={`text-lg text-[#B8D8D8] mb-6 ${isHe ? 'text-right' : 'text-left'}`}>
                {isHe ? 'סיכום הצעה' : 'Quote Summary'}
              </h3>
              {selectedVehicle ? (
                <>
                  <div className={isHe ? 'text-right' : 'text-left'}>
                    <div className="text-6xl font-black text-[#E8743B] mb-1 tabular-nums">
                      ₪{monthlyPrice.toLocaleString()}
                    </div>
                    <div className="text-[#B8D8D8] text-sm mb-1">
                      {isHe ? 'לחודש, כולל מע"מ' : 'per month, incl. VAT'}
                    </div>
                    {/* Issue 11: disclaimer */}
                    <p className="text-xs text-white/40 mb-6">
                      {isHe
                        ? 'המחיר המוצג אינו סופי. המחיר הסופי יאושר מול נציג.'
                        : 'The displayed price is not final. The final price will be confirmed with a representative.'}
                    </p>
                  </div>
                  <div className={`space-y-3 text-sm border-t border-white/20 pt-4 ${isHe ? 'text-right' : 'text-left'}`}>
                    <div className={`flex justify-between ${isHe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[#B8D8D8]">{isHe ? 'רכב' : 'Vehicle'}</span>
                      <span className="text-white">{selectedVehicle.make} {selectedVehicle.model}</span>
                    </div>
                    <div className={`flex justify-between ${isHe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[#B8D8D8]">{isHe ? 'משך חוזה' : 'Duration'}</span>
                      <span className="text-white">{duration} {isHe ? 'חודשים' : 'months'}</span>
                    </div>
                    <div className={`flex justify-between ${isHe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[#B8D8D8]">{isHe ? 'קילומטרז׳' : 'Mileage'}</span>
                      <span className="text-white">{isHe ? MILEAGE_OPTIONS.find(o => o.value === mileage)?.labelHe : MILEAGE_OPTIONS.find(o => o.value === mileage)?.labelEn}</span>
                    </div>
                    <div className={`flex justify-between border-t border-white/20 pt-3 ${isHe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[#B8D8D8]">{isHe ? 'סה"כ לתקופה' : 'Total for period'}</span>
                      <span className="text-white font-bold">₪{(monthlyPrice * duration).toLocaleString()}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className={`text-[#B8D8D8] py-12 ${isHe ? 'text-right' : 'text-left'}`}>
                  {isHe ? 'בחר רכב לחישוב מחיר' : 'Select a vehicle to calculate'}
                </p>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => setShowForm(f => !f)}
                disabled={!selectedVehicle}
                className="w-full bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-[#0D2B2B] py-3.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {isHe ? 'שלח פנייה באתר' : 'Submit Inquiry Online'}
              </button>
              <button
                onClick={handleWhatsApp}
                disabled={!selectedVehicle}
                className="w-full bg-[#E8743B] hover:bg-[#d4632a] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-sm transition-colors"
              >
                {isHe ? 'שלח בקשה בוואטסאפ' : 'Send Request via WhatsApp'}
              </button>
              <a href="tel:09-9509757" className="flex items-center justify-center gap-2 w-full border border-white/40 hover:border-white text-white py-3 rounded-xl transition-colors text-sm">
                <Phone className="w-4 h-4" />09-9509757
              </a>
              <a href="mailto:office@smartcar.co.il" className="flex items-center justify-center gap-2 w-full border border-white/40 hover:border-white text-white py-3 rounded-xl transition-colors text-sm">
                <Mail className="w-4 h-4" />office@smartcar.co.il
              </a>
            </div>
          </div>
        </div>

        {/* In-site inquiry form – Issue 7 */}
        {showForm && selectedVehicle && (
          <div className="mt-8 bg-[#eef6f6] border-2 border-[#B8D8D8] rounded-2xl p-8" dir={isHe ? 'rtl' : 'ltr'}>
            <h3 className={`text-xl font-black text-[#0D2B2B] mb-1 ${isHe ? 'text-right' : 'text-left'}`}>
              {isHe ? 'שלח פנייה לליסינג' : 'Submit a Leasing Inquiry'}
            </h3>
            <p className={`text-sm text-gray-500 mb-6 ${isHe ? 'text-right' : 'text-left'}`}>
              {isHe
                ? `פנייה עבור: ${selectedVehicle.make} ${selectedVehicle.model} — ${duration} חודשים`
                : `Inquiry for: ${selectedVehicle.make} ${selectedVehicle.model} — ${duration} months`}
            </p>
            <form onSubmit={handleSubmitInquiry} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isHe ? 'שם מלא *' : 'Full Name *'}
                </label>
                <input type="text" required value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder={isHe ? 'ישראל ישראלי' : 'John Doe'}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] bg-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isHe ? 'טלפון *' : 'Phone *'}
                </label>
                <input type="tel" required value={formPhone} onChange={e => setFormPhone(e.target.value)}
                  placeholder="050-0000000"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] bg-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isHe ? 'אימייל' : 'Email'}
                </label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] bg-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isHe ? 'רכב נבחר' : 'Selected Vehicle'}
                </label>
                <div className="w-full p-3 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-600">
                  {selectedVehicle.make} {selectedVehicle.model}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isHe ? 'הודעה' : 'Message'}
                </label>
                <textarea value={formMessage} onChange={e => setFormMessage(e.target.value)} rows={3}
                  placeholder={isHe ? 'פרטים נוספים, שאלות...' : 'Additional details, questions...'}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] resize-none bg-white" />
              </div>
              <div className="sm:col-span-2">
                <TurnstileWidget onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
              </div>
              {formError && <p className="sm:col-span-2 text-red-600 text-sm">{formError}</p>}
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={formSending || !formName.trim() || !formPhone.trim() || !turnstileToken}
                  className="flex-1 bg-[#E8743B] disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm hover:bg-[#d4632a] transition-colors flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  {formSending ? (isHe ? 'שולח...' : 'Sending...') : (isHe ? 'שלח פנייה' : 'Submit Inquiry')}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-6 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}

        {formSent && !showForm && (
          <div className="mt-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700" dir={isHe ? 'rtl' : 'ltr'}>
            <CheckCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">
              {isHe ? 'תודה! פנייתך התקבלה. נציג יחזור אליך בהקדם.' : 'Thank you! Your inquiry has been received. A representative will contact you shortly.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function LeasingInquirySection({ vehicles, locale }: { vehicles: Vehicle[]; locale: string }) {
  return (
    <Suspense fallback={
      <section id="calculator" className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 h-64 animate-pulse bg-gray-100 rounded-2xl" />
      </section>
    }>
      <InquiryContent vehicles={vehicles} locale={locale} />
    </Suspense>
  );
}
