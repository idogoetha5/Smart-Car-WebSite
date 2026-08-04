'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Users, DoorOpen, Fuel, Settings, Star } from 'lucide-react';
import type { Vehicle } from '@/types';
import { getSeasonalPrice } from '@/lib/seasonal';
import { usePricingConfig } from '@/hooks/usePricingConfig';

const categoryLabelHe: Record<string, string> = {
  MINI:       'מיני',
  ECONOMY:    'אקונומי / קומפקטי',
  COMPACT:    'אקונומי / קומפקטי',
  SEDAN:      'סדאן',
  CROSSOVER:  'קרוסאובר',
  SUV:        'SUV',
  LUXURY:     'יוקרה',
  VAN:        'ואן',
  COMMERCIAL: 'מסחרי',
  ELECTRIC:   'חשמלי',
};
const categoryLabelEn: Record<string, string> = {
  MINI:       'Mini',
  ECONOMY:    'Economy / Compact',
  COMPACT:    'Economy / Compact',
  SEDAN:      'Sedan',
  CROSSOVER:  'Crossover',
  SUV:        'SUV',
  LUXURY:     'Luxury',
  VAN:        'Van',
  COMMERCIAL: 'Commercial',
  ELECTRIC:   'Electric',
};

const categoryColors: Record<string, string> = {
  MINI:       'bg-lime-100 text-lime-700',
  ECONOMY:    'bg-green-100 text-green-700',
  COMPACT:    'bg-green-100 text-green-700',
  SEDAN:      'bg-gray-100 text-gray-700',
  CROSSOVER:  'bg-sky-100 text-sky-700',
  SUV:        'bg-orange-100 text-orange-700',
  LUXURY:     'bg-purple-100 text-purple-700',
  VAN:        'bg-yellow-100 text-yellow-700',
  COMMERCIAL: 'bg-blue-100 text-blue-700',
  ELECTRIC:   'bg-teal-100 text-teal-700',
};


function CarPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#eef6f6]">
      <svg viewBox="0 0 80 48" fill="none" className="w-28 h-20 text-[#2D5F5F]" aria-hidden="true">
        <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor" opacity="0.15"/>
        <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round"/>
        <circle cx="20" cy="38" r="6" fill="currentColor"/>
        <circle cx="60" cy="38" r="6" fill="currentColor"/>
        <line x1="32" y1="16" x2="48" y2="16" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      </svg>
    </div>
  );
}

export interface VehicleCardProps {
  vehicle: Vehicle;
  variants?: Vehicle[];
  pickupDate?: string;
  returnDate?: string;
  location?: string;
  pickupLocation?: string;
  returnLocation?: string;
  /** Eager-load the image (only for the first few above-the-fold cards). */
  priority?: boolean;
}

export default function VehicleCard({ vehicle: initialVehicle, variants = [], pickupDate, returnDate, location, pickupLocation, returnLocation, priority = false }: VehicleCardProps) {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const isHe = locale === 'he';
  const { config: pricingConfig } = usePricingConfig();

  const allVariants = variants.length > 0 ? variants : [initialVehicle];
  const [selected] = useState(0);
  const vehicle = allVariants[selected];

  const images = (vehicle.imageUrls ?? []).filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);
  const currentImg = images[imgIdx] ?? null;

  const prevImg = (e: React.MouseEvent) => {
    e.preventDefault();
    setImgIdx(i => (i - 1 + images.length) % images.length);
  };
  const nextImg = (e: React.MouseEvent) => {
    e.preventDefault();
    setImgIdx(i => (i + 1) % images.length);
  };

  return (
    <div className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-100 flex flex-col">

      {/* Image carousel */}
      <div className="relative overflow-hidden bg-gradient-to-b from-white to-gray-100" style={{ height: '200px' }}>
        {currentImg ? (
          <>
            <Image
              key={currentImg}
              src={currentImg}
              alt={isHe
                ? `${vehicle.year} ${vehicle.make} ${vehicle.model} — תמונה ${imgIdx + 1} מתוך ${images.length}`
                : `${vehicle.year} ${vehicle.make} ${vehicle.model} — image ${imgIdx + 1} of ${images.length}`}
              fill
              priority={priority && imgIdx === 0}
              loading={priority ? undefined : 'lazy'}
              className="object-contain"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            {/* Soft ground shadow — gives the car a sense of sitting on a
                surface without a literal 3D render. The source photos are
                opaque (their own white background baked in), so this has
                to sit ON TOP of the image and darken it with a blend mode
                rather than behind it, where an opaque photo would just
                hide it entirely. A fixed ellipse near the bottom works
                across different photos since the car is always roughly
                centered in its source image. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 bottom-[14%] -translate-x-1/2 w-[58%] h-5 rounded-full bg-black/40 blur-md mix-blend-multiply"
            />
          </>
        ) : (
          <CarPlaceholder />
        )}
        <div className="car-placeholder-fallback absolute inset-0 hidden items-center justify-center bg-[#eef6f6]">
          <svg viewBox="0 0 80 48" fill="none" className="w-28 h-20 text-[#2D5F5F]" aria-hidden="true">
            <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor" opacity="0.15"/>
            <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round"/>
            <circle cx="20" cy="38" r="6" fill="currentColor"/>
            <circle cx="60" cy="38" r="6" fill="currentColor"/>
            <line x1="32" y1="16" x2="48" y2="16" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
          </svg>
        </div>

        {/* Arrows — only when multiple images */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImg}
              type="button"
              className="absolute start-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white shadow flex items-center justify-center z-10 transition-opacity duration-200 opacity-80 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] focus-visible:ring-offset-1"
              aria-label={isHe ? 'התמונה הקודמת' : 'Previous image'}
            >
              <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                {isHe ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
              </svg>
            </button>
            <button
              onClick={nextImg}
              type="button"
              className="absolute end-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white shadow flex items-center justify-center z-10 transition-opacity duration-200 opacity-80 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] focus-visible:ring-offset-1"
              aria-label={isHe ? 'התמונה הבאה' : 'Next image'}
            >
              <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                {isHe ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
              </svg>
            </button>

            {/* Counter + Dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
              <span className="text-[10px] text-white/80 bg-black/30 rounded-full px-2 py-0.5 tabular-nums">{imgIdx + 1} / {images.length}</span>
              <div className="flex gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.preventDefault(); setImgIdx(i); }}
                    // The dot itself stays 6px; the button around it is 24px,
                    // which is the smallest target WCAG accepts. It used to be
                    // the dot — a 6px tap target.
                    className="w-6 h-6 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F]"
                    aria-label={isHe ? `תמונה ${i + 1} מתוך ${images.length}` : `Image ${i + 1} of ${images.length}`}
                    aria-current={i === imgIdx ? 'true' : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className={`rounded-full transition-all duration-200 ${i === imgIdx ? 'w-4 h-1.5 bg-[#2D5F5F]' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/90'}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Category badge */}
        <div className="absolute top-3 start-3 flex flex-col gap-1.5">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${categoryColors[vehicle.category] ?? 'bg-gray-100 text-gray-700'}`}>
            {(isHe ? categoryLabelHe : categoryLabelEn)[vehicle.category] ?? vehicle.category}
          </span>
          {vehicle.isFeatured && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#C24E17]/10 text-[#B64916] flex items-center gap-1">
              <Star className="w-3 h-3 fill-[#E8743B] stroke-[#E8743B]" />
              {isHe ? 'מומלץ' : 'Featured'}
            </span>
          )}
        </div>

        {/* Availability. The catalogue is only part of the fleet, so a
            listing never asserts that a vehicle is free or taken — both
            states invite a real availability check instead. The former
            red "תפוס" overlay told customers no vehicle existed, which
            the online catalogue cannot know. */}
        <div className="absolute top-3 end-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#2D5F5F] text-white">
            {t('available')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-bold text-lg text-gray-900 leading-tight">
            {vehicle.make} {vehicle.model}
          </h3>
        </div>


        <div className="grid grid-cols-2 gap-2 mb-4 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#2D5F5F]" />
            <span>{vehicle.seats} {t('seats')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <DoorOpen className="w-4 h-4 text-[#2D5F5F]" />
            <span>{vehicle.doors} {t('doors')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-[#2D5F5F]" />
            <span>{vehicle.transmission === 'AUTOMATIC' ? (isHe ? 'אוטומטי' : 'Automatic') : (isHe ? 'ידני' : 'Manual')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Fuel className="w-4 h-4 text-[#2D5F5F]" />
            <span>{
              vehicle.fuelType === 'GASOLINE' ? (isHe ? 'בנזין' : 'Gasoline') :
              vehicle.fuelType === 'DIESEL'   ? (isHe ? 'דיזל'  : 'Diesel')   :
              vehicle.fuelType === 'ELECTRIC' ? (isHe ? 'חשמלי' : 'Electric') :
              vehicle.fuelType === 'HYBRID'   ? (isHe ? 'היברידי' : 'Hybrid') :
              vehicle.fuelType
            }</span>
          </div>
        </div>

        <div className="flex-1" />

        <div className="mb-4 pt-3 border-t border-gray-100">
          {pickupDate && returnDate ? (() => {
            const days = Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86400000));
            const ppd = getSeasonalPrice(vehicle, pricingConfig, new Date(pickupDate));
            const total = days * ppd;
            return (
              <div className="text-center">
                <span className="text-2xl font-black text-[#2D5F5F]">₪{total.toLocaleString()}</span>
                <span className="text-xs text-gray-600 block mt-0.5">{isHe ? `${days} ימים × ₪${ppd}/יום` : `${days} days × ₪${ppd}/day`}</span>
              </div>
            );
          })() : (
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-0.5">{isHe ? 'החל מ' : 'From'}</p>
              <span className="text-2xl font-black text-[#2D5F5F]">₪{vehicle.pricePerDay.toLocaleString()}</span>
              <span className="text-xs text-gray-600 block mt-0.5">/{isHe ? 'ליום' : 'day'}</span>
            </div>
          )}
        </div>

        {/* One action per card on the rental pages. The leasing button that
            used to sit beside this one gave every rental card two competing
            calls to action; leasing has its own page and its own cards.
            The request path is never blocked — the online catalogue holds
            only part of the fleet. */}
        <Link
          href={(() => {
            const p = new URLSearchParams();
            if (pickupDate) p.set('pickup', pickupDate);
            if (returnDate) p.set('return', returnDate);
            if (location) p.set('location', location);
            if (pickupLocation) p.set('pickupLocation', pickupLocation);
            if (returnLocation) p.set('returnLocation', returnLocation);
            const qs = p.toString();
            return `/${locale}/rental/${vehicle.id}${qs ? '?' + qs : ''}`;
          })()}
          className="block w-full py-2.5 px-4 bg-[#2D5F5F] text-white text-sm font-bold rounded-xl hover:bg-[#1A3A3A] transition-colors text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] focus-visible:ring-offset-2"
        >
          {t('book_now')}
        </Link>
      </div>
    </div>
  );
}
