import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'yellow' | 'purple';
  trend?: string;
}

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-100' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', border: 'border-yellow-100' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100' },
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  trend,
}: StatsCardProps) {
  const c = colorMap[color];
  return (
    <div className={cn('bg-white rounded-2xl border p-6 shadow-sm', c.border)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
        </div>
        <div className={cn('p-3 rounded-xl', c.bg)}>
          <Icon className={cn('w-6 h-6', c.icon)} />
        </div>
      </div>
    </div>
  );
}
