'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import DatePickerInput, { type DatePickerHandle } from '@/components/ui/DatePickerInput';

const BRANCHES_HE = [
  { value: 'herzliya',  label: 'סניף הרצליה' },
  { value: 'telaviv',   label: 'סניף תל אביב' },
  { value: 'jerusalem', label: 'סניף ירושלים' },
  { value: 'airport',   label: 'נתב"ג' },
];

const BRANCHES_EN = [
  { value: 'herzliya',  label: 'Herzliya' },
  { value: 'telaviv',   label: 'Tel Aviv' },
  { value: 'jerusalem', label: 'Jerusalem' },
  { value: 'airport',   label: 'Ben Gurion Airport' },
];

function LocationField({
  label, value, setValue, customVal, setCustomVal, showCustom, setShowCustom, isHe, branches,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  customVal: string;
  setCustomVal: (v: string) => void;
  showCustom: boolean;
  setShowCustom: (v: boolean) => void;
  isHe: boolean;
  branches: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-600 whitespace-nowrap">{label}</p>
      {showCustom ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            autoFocus
            aria-label={label}
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            placeholder={isHe ? 'הקלד כתובת...' : 'Type address...'}
            className="w-full text-xs sm:text-sm text-gray-700 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] focus-visible:ring-offset-1 rounded bg-transparent"
          />
          <button
            onClick={() => { setShowCustom(false); setCustomVal(''); setValue(''); }}
            className="text-gray-600 hover:text-gray-600 text-xs shrink-0"
          >✕</button>
        </div>
      ) : (
        <select
          value={value}
          aria-label={label}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              setShowCustom(true);
              setValue('');
            } else {
              setValue(e.target.value);
            }
          }}
          className="w-full text-xs sm:text-sm text-gray-700 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] focus-visible:ring-offset-1 rounded bg-transparent cursor-pointer"
        >
          <option value="">{isHe ? 'בחר סניף' : 'Select location'}</option>
          {branches.map(b => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
          <option value="custom">📍 {isHe ? 'כתובת אחרת...' : 'Other address...'}</option>
        </select>
      )}
    </div>
  );
}

export default function HeroSection({ locale }: { locale: string }) {
  const t  = useTranslations('hero');
  const ts = useTranslations('services');
  const isHe = locale === 'he';
  const today = new Date().toISOString().split('T')[0];

  const [pickupLocation, setPickupLocation]     = useState('');
  const [pickupCustom, setPickupCustom]         = useState('');
  const [showPickupCustom, setShowPickupCustom] = useState(false);
  const [returnLocation, setReturnLocation]     = useState('');
  const [returnCustom, setReturnCustom]         = useState('');
  const [showReturnCustom, setShowReturnCustom] = useState(false);
  const [pickupDate, setPickupDate]             = useState('');
  const [returnDate, setReturnDate]             = useState('');
  const returnRefMobile  = useRef<DatePickerHandle>(null);

  // Pointer-driven 3D tilt for the hero car
  const carTiltX = useMotionValue(0);
  const carTiltY = useMotionValue(0);
  const carRotateX = useSpring(useTransform(carTiltY, [-0.5, 0.5], [12, -12]), { stiffness: 200, damping: 20 });
  const carRotateY = useSpring(useTransform(carTiltX, [-0.5, 0.5], [-12, 12]), { stiffness: 200, damping: 20 });
  const handleCarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    carTiltX.set((e.clientX - rect.left) / rect.width - 0.5);
    carTiltY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleCarPointerLeave = () => {
    carTiltX.set(0);
    carTiltY.set(0);
  };
  const returnRefDesktop = useRef<DatePickerHandle>(null);
  const router = useRouter();
  const branches = isHe ? BRANCHES_HE : BRANCHES_EN;

  const handleSearch = () => {
    if (!pickupDate || !returnDate) {
      alert(isHe ? 'יש לבחור תאריכי איסוף והחזרה.' : 'Please select pick-up and return dates.');
      return;
    }
    const params = new URLSearchParams();
    params.set('pickup', pickupDate);
    params.set('return', returnDate);
    const pLoc = showPickupCustom ? pickupCustom : pickupLocation;
    const rLoc = showReturnCustom ? returnCustom : (returnLocation || pLoc);
    if (pLoc) params.set('pickupLocation', pLoc);
    if (rLoc) params.set('returnLocation', rLoc);
    router.push(`/${locale}/rental?${params.toString()}`);
  };

  const SERVICES = [
    {
      label: ts('business'),
      href: `/${locale}/services/business`,
      // briefcase with handle and a softly curved front seam
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto mb-3">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          <path d="M22 12.5a18.2 18.2 0 0 1-20 0"/>
          <path d="M11.4 13.6h1.2"/>
        </svg>
      ),
    },
    {
      label: ts('new_driver'),
      href: `/${locale}/services/new-driver`,
      // driver's license card
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto mb-3">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <circle cx="7.5" cy="10" r="2"/>
          <path d="M4 19a3.5 3.5 0 017 0"/>
          <line x1="13" y1="9" x2="20" y2="9"/>
          <line x1="13" y1="12.5" x2="18" y2="12.5"/>
          <line x1="13" y1="16" x2="16" y2="16"/>
        </svg>
      ),
    },
    {
      label: ts('car_sale'),
      href: `/${locale}/services/sale`,
      // car side-view + transfer/ownership arrow below
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto mb-3">
          <rect x="1" y="9" width="18" height="6" rx="2"/>
          <path d="M3 9 l2.5-4 h9 l2.5 4"/>
          <circle cx="5.5" cy="15" r="2"/>
          <circle cx="14.5" cy="15" r="2"/>
          <path d="M4 20 q8 4 16 0"/>
          <path d="M17 18.5 l3 1.5 -3 1.5"/>
        </svg>
      ),
    },
    {
      label: ts('leasing'),
      href: `/${locale}/services/leasing`,
      // contract document: folded corner, text lines, signature + pen nib
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto mb-3">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="8" y1="15" x2="16" y2="15"/>
          <path d="M7 19 q4 -2 8 0"/>
          <path d="M15 19 l2 -2 1 1 -2 2 -1 -1 z"/>
        </svg>
      ),
    },
    {
      label: ts('hourly'),
      href: `/${locale}/services/hourly`,
      // history / clock-with-back-arrow
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto mb-3">
          <path d="M3 12a9 9 0 1 0 9-9 9.1 9.1 0 0 0-6.36 2.64"/>
          <polyline points="3 3 3 9 9 9"/>
          <polyline points="12 7 12 12 15 14"/>
        </svg>
      ),
    },
    {
      label: ts('commercial'),
      href: `/${locale}/services/commercial`,
      // delivery truck with speed lines
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto mb-3">
          <rect x="2" y="3" width="14" height="13" rx="1"/>
          <path d="M16 8h4l3 3v5h-7V8z"/>
          <circle cx="6" cy="18.5" r="2.5"/>
          <circle cx="19" cy="18.5" r="2.5"/>
          <line x1="2" y1="7" x2="0" y2="7"/>
          <line x1="2" y1="10" x2="-1" y2="10"/>
          <line x1="2" y1="13" x2="0" y2="13"/>
        </svg>
      ),
    },
    {
      label: ts('daily'),
      href: `/${locale}/services/daily`,
      // sunrise over a car — single day rental
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto mb-3">
          <path d="M8.8 9.2a3.2 3.2 0 0 1 6.4 0"/>
          <line x1="12" y1="1.2" x2="12" y2="2.8"/>
          <line x1="6.9" y1="4.1" x2="8" y2="5.2"/>
          <line x1="17.1" y1="4.1" x2="16" y2="5.2"/>
          <line x1="4.4" y1="9.2" x2="6.4" y2="9.2"/>
          <line x1="17.6" y1="9.2" x2="19.6" y2="9.2"/>
          <path d="M2.4 18.6v-3.1a1 1 0 0 1 .7-1l1.6-.5 2-2.6a1.4 1.4 0 0 1 1.1-.6h8.4a1.4 1.4 0 0 1 1.1.6l2 2.6 1.6.5a1 1 0 0 1 .7 1v3.1"/>
          {/* The beltline and the B-pillar used to sit inside the body here.
              With the sun and its five rays already above it, this icon
              carried twelve strokes against three in the clock beside it and
              read as a dark blot at 40px. The silhouette and the wheels
              still say "car", so only the interior detail came out. */}
          <path d="M2.4 18.6h2.2M9 18.6h6M19.4 18.6h2.2"/>
          <circle cx="6.6" cy="18.6" r="1.7"/>
          <circle cx="17.4" cy="18.6" r="1.7"/>
        </svg>
      ),
    },
    {
      label: ts('monthly'),
      href: `/${locale}/services/monthly`,
      // calendar with "31" and two ring-binders
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto mb-3">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <text x="12" y="19" textAnchor="middle" fontSize="7" fill="#E8743B" stroke="none" fontWeight="bold">31</text>
        </svg>
      ),
    },
  ];

  return (
    <section className="w-full overflow-hidden">

      {/* ══ TOP: Light blue, rounded bottom ══ */}
      <div className="bg-[#D6EEF5] rounded-b-[clamp(30px,5vw,80px)] pt-8 pb-10 px-4 md:px-6 text-center relative z-20">
        <h1 className="font-light text-[#1a1a2e] mb-2 tracking-tight" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.5rem)' }}>
          {t('title')}
        </h1>
        <p className="text-gray-600 text-sm md:text-base mb-6 md:mb-8 px-2">
          {t('search_subtitle')}
        </p>

        {/* Search pill */}
        <div className="max-w-4xl mx-auto">

          {/* ── Mobile (< md) ── */}
          <div className="md:hidden bg-white rounded-2xl shadow-md overflow-hidden text-start" dir={isHe ? 'rtl' : 'ltr'}>
            {/* Pickup location */}
            <div className="px-4 py-3 border-b border-gray-100">
              <LocationField
                label={isHe ? 'מיקום איסוף' : 'Pickup location'}
                value={pickupLocation}
                setValue={setPickupLocation}
                customVal={pickupCustom}
                setCustomVal={setPickupCustom}
                showCustom={showPickupCustom}
                setShowCustom={setShowPickupCustom}
                isHe={isHe}
                branches={branches}
              />
            </div>
            {/* Return location */}
            <div className="px-4 py-3 border-b border-gray-100">
              <LocationField
                label={isHe ? 'מיקום החזרה' : 'Return location'}
                value={returnLocation}
                setValue={setReturnLocation}
                customVal={returnCustom}
                setCustomVal={setReturnCustom}
                showCustom={showReturnCustom}
                setShowCustom={setShowReturnCustom}
                isHe={isHe}
                branches={branches}
              />
            </div>
            {/* Dates — side by side */}
            <div className="flex border-b border-gray-100">
              <div className="flex-1 px-4 py-3 border-e border-gray-100">
                <p className="text-xs text-gray-600 mb-1">{t('pickup_date_label')}</p>
                <DatePickerInput
                  value={pickupDate}
                  onChange={(date) => {
                    setPickupDate(date);
                    if (returnDate && returnDate < date) setReturnDate('');
                    setTimeout(() => returnRefMobile.current?.openPicker(), 80);
                  }}
                  minDate={today}
                  placeholder={isHe ? 'בחר תאריך' : 'Select date'}
                  isHe={isHe}
                  className="w-full"
                />
              </div>
              <div className="flex-1 px-4 py-3">
                <p className="text-xs text-gray-600 mb-1">{t('return_date_label')}</p>
                <DatePickerInput
                  ref={returnRefMobile}
                  value={returnDate}
                  onChange={setReturnDate}
                  minDate={pickupDate || today}
                  placeholder={isHe ? 'בחר תאריך' : 'Select date'}
                  isHe={isHe}
                  className="w-full"
                />
              </div>
            </div>
            {/* Search button — full width */}
            <div className="p-3">
              <button
                onClick={handleSearch}
                className="w-full bg-[#2D5F5F] hover:bg-[#1a4040] text-white rounded-xl py-3 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg aria-hidden="true" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                {isHe ? 'חפש רכב' : 'Search'}
              </button>
            </div>
          </div>

          {/* ── Desktop (≥ md) ── */}
          <div className="hidden md:flex bg-white rounded-2xl shadow-md items-center px-2 py-2 gap-0" dir={isHe ? 'rtl' : 'ltr'}>
            {/* Pickup location */}
            <div className="flex-1 flex items-center text-start ps-3 min-w-[140px]">
              <LocationField
                label={isHe ? 'מיקום איסוף' : 'Pickup location'}
                value={pickupLocation}
                setValue={setPickupLocation}
                customVal={pickupCustom}
                setCustomVal={setPickupCustom}
                showCustom={showPickupCustom}
                setShowCustom={setShowPickupCustom}
                isHe={isHe}
                branches={branches}
              />
            </div>
            <div className="w-px h-8 bg-gray-200 flex-shrink-0"/>
            {/* Return location */}
            <div className="flex-1 flex items-center text-start ps-3 min-w-[140px]">
              <LocationField
                label={isHe ? 'מיקום החזרה' : 'Return location'}
                value={returnLocation}
                setValue={setReturnLocation}
                customVal={returnCustom}
                setCustomVal={setReturnCustom}
                showCustom={showReturnCustom}
                setShowCustom={setShowReturnCustom}
                isHe={isHe}
                branches={branches}
              />
            </div>
            <div className="w-px h-8 bg-gray-200 flex-shrink-0"/>
            {/* Pickup date */}
            <div className="flex-1 flex items-center text-start ps-3 min-w-[110px]">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 whitespace-nowrap">{t('pickup_date_label')}</p>
                <DatePickerInput
                  value={pickupDate}
                  onChange={(date) => {
                    setPickupDate(date);
                    if (returnDate && returnDate < date) setReturnDate('');
                    setTimeout(() => returnRefDesktop.current?.openPicker(), 80);
                  }}
                  minDate={today}
                  placeholder={isHe ? 'בחר תאריך' : 'Select date'}
                  isHe={isHe}
                  className="w-full"
                />
              </div>
            </div>
            <div className="w-px h-8 bg-gray-200 flex-shrink-0"/>
            {/* Return date */}
            <div className="flex-1 flex items-center text-start ps-3 min-w-[110px]">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 whitespace-nowrap">{t('return_date_label')}</p>
                <DatePickerInput
                  ref={returnRefDesktop}
                  value={returnDate}
                  onChange={setReturnDate}
                  minDate={pickupDate || today}
                  placeholder={isHe ? 'בחר תאריך' : 'Select date'}
                  isHe={isHe}
                  className="w-full"
                />
              </div>
            </div>
            {/* Search button */}
            <button
              onClick={handleSearch}
              className="bg-[#2D5F5F] hover:bg-[#1a4040] text-white rounded-full w-11 h-11 flex items-center justify-center flex-shrink-0 transition-colors ms-1"
              aria-label={t('search_btn')}
            >
              <svg aria-hidden="true" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
          </div>

        </div>
      </div>

      {/* ══ MIDDLE: White bg, full car visible ══ */}
      <div className="bg-white relative overflow-hidden h-[calc(55vw*705/1400)] md:h-[320px]">

        {/* Tagline — LEFT, wraps on mobile, single line on desktop */}
        <div className="absolute left-4 md:left-16 top-2 translate-y-0 md:top-1/2 md:-translate-y-1/2 z-10 max-w-[48%] md:max-w-none">
          <p className="text-[#B64916] text-3xl md:text-6xl font-bold italic leading-tight md:whitespace-nowrap">
            {'Join us'}<br className="md:hidden" /><span className="hidden md:inline">{' '}</span>{'for a ride'}
          </p>
        </div>

        {/* Car — RIGHT, drives in from off-screen on mount, tilts in 3D on hover */}
        <motion.div
          className="absolute right-0 bottom-0"
          style={{ width: '55%', maxWidth: '600px', perspective: 1000 }}
          initial={{ x: '110%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
          onPointerMove={handleCarPointerMove}
          onPointerLeave={handleCarPointerLeave}
        >
          <motion.div style={{ rotateX: carRotateX, rotateY: carRotateY, transformStyle: 'preserve-3d' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-car.webp"
              alt="SmartCar"
              className="w-full"
              style={{
                objectFit: 'contain',
                objectPosition: 'bottom right',
                display: 'block',
              }}
              // The previous fallback pointed at /images/car-placeholder.svg,
              // which has never existed in this repo — so a failed hero image
              // swapped one 404 for another and left a broken-image icon.
              // Hiding it leaves the hero clean instead.
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </motion.div>
        </motion.div>
      </div>

      {/* ══ BOTTOM: Dark teal, service categories ══ */}
      <div className="bg-[#2D5F5F] px-6 py-12">
        <h2 className="text-white text-2xl font-bold text-center mb-10">
          {ts('title')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {SERVICES.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="bg-white rounded-3xl p-5 text-center hover:shadow-xl transition-shadow group flex flex-col items-center"
            >
              {item.icon}
              <p className="text-sm font-semibold text-[#0D2B2B] group-hover:text-[#B64916] transition-colors leading-tight">
                {item.label}
              </p>
            </Link>
          ))}
        </div>
      </div>

    </section>
  );
}
