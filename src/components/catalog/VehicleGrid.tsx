'use client';

import { useTranslations, useLocale } from 'next-intl';
import VehicleCard from './VehicleCard';
import type { Vehicle } from '@/types';

interface VehicleGridProps {
  vehicles: Vehicle[];
  isLoading?: boolean;
  pickupDate?: string;
  returnDate?: string;
  location?: string;
  pickupLocation?: string;
  returnLocation?: string;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-52 bg-gray-200" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded" />
          ))}
        </div>
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-10 bg-gray-200 rounded-xl" />
          <div className="h-10 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function VehicleGrid({ vehicles, isLoading, pickupDate, returnDate, location, pickupLocation, returnLocation }: VehicleGridProps) {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const isHe = locale === 'he';

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg viewBox="0 0 80 48" fill="none" className="w-24 h-16 text-[#2D5F5F] mb-5 opacity-30" aria-hidden="true">
          <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor"/>
          <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round"/>
          <circle cx="20" cy="38" r="6" fill="currentColor"/>
          <circle cx="60" cy="38" r="6" fill="currentColor"/>
        </svg>
        <p className="text-gray-700 text-xl font-semibold mb-2">{t('no_results')}</p>
        <p className="text-gray-400 text-sm mb-6">{isHe ? 'נסה לשנות את הפילטרים או צור קשר לעזרה' : 'Try changing your filters or contact us for help'}</p>
        <div className="flex gap-3 flex-wrap justify-center">
          <a
            href="tel:09-9509757"
            className="px-5 py-2.5 bg-[#E8743B] text-white font-bold rounded-xl hover:bg-[#d4622a] transition-colors text-sm"
          >
            {isHe ? 'התקשר עכשיו' : 'Call us'}
          </a>
          <a
            href="https://wa.me/97299509757"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#1ebe5d] transition-colors text-sm"
          >
            WhatsApp
          </a>
        </div>
      </div>
    );
  }

  const grouped = vehicles.reduce((acc, v) => {
    const key = `${v.make}__${v.model}__${v.year}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(v);
    return acc;
  }, {} as Record<string, Vehicle[]>);

  const groups = Object.values(grouped);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {groups.map((group) => (
        <VehicleCard
          key={group[0].id}
          vehicle={group[0]}
          variants={group}
          pickupDate={pickupDate}
          returnDate={returnDate}
          location={location}
          pickupLocation={pickupLocation}
          returnLocation={returnLocation}
        />
      ))}
    </div>
  );
}
