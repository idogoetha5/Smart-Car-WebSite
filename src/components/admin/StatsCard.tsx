import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'yellow' | 'purple';
  trend?: string;
  href?: string;
}

const colorMap = {
  blue: { bg: 'bg-[#eaf4f4]', icon: 'text-[#2D5F5F]', border: 'border-[#d5e8e8]' },
  green: { bg: 'bg-emerald-50', icon: 'text-emerald-700', border: 'border-emerald-100' },
  yellow: { bg: 'bg-amber-50', icon: 'text-amber-700', border: 'border-amber-100' },
  purple: { bg: 'bg-orange-50', icon: 'text-[#C65D2C]', border: 'border-orange-100' },
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  trend,
  href,
}: StatsCardProps) {
  const c = colorMap[color];
  const content = (
    <div className={cn('min-h-32 bg-white rounded-2xl border p-4 sm:p-5 shadow-[0_8px_24px_rgba(13,43,43,0.05)]', c.border)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-slate-500 mb-1">{title}</p>
          <p className="text-3xl font-black tracking-tight text-[#0D2B2B]">{value}</p>
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', c.bg)}>
          <Icon className={cn('w-5 h-5', c.icon)} />
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-2xl outline-offset-4 transition hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-[#2D5F5F]">{content}</Link> : content;
}
