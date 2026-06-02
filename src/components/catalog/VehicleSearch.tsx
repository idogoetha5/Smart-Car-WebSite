'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface VehicleSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function VehicleSearch({ value, onChange }: VehicleSearchProps) {
  const t = useTranslations('catalog');

  return (
    <div className="relative">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${t('title')}...`}
        className="w-full h-11 ps-10 pe-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
