'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { Vehicle } from '@/types';

interface VehicleTableProps {
  vehicles: Vehicle[];
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (id: string) => void;
}

export default function VehicleTable({
  vehicles,
  onEdit,
  onDelete,
}: VehicleTableProps) {
  const t = useTranslations('admin');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-100">
            <th className="pb-3 font-semibold text-gray-500 pe-4">Vehicle</th>
            <th className="pb-3 font-semibold text-gray-500 pe-4">Category</th>
            <th className="pb-3 font-semibold text-gray-500 pe-4">Price/Day</th>
            <th className="pb-3 font-semibold text-gray-500 pe-4">{t('status')}</th>
            <th className="pb-3 font-semibold text-gray-500">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {vehicles.map((v) => (
            <tr key={v.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 pe-4 font-medium text-gray-900">
                {v.year} {v.make} {v.model}
              </td>
              <td className="py-3 pe-4">
                <Badge color="blue">{v.category}</Badge>
              </td>
              <td className="py-3 pe-4 font-semibold text-gray-700">
                ₪{v.pricePerDay}
              </td>
              <td className="py-3 pe-4">
                <Badge color={v.isAvailable ? 'green' : 'red'}>
                  {v.isAvailable ? 'Available' : 'Unavailable'}
                </Badge>
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(v)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      aria-label={t('edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        if (confirm(t('confirm_delete'))) onDelete(v.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
