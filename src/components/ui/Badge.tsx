import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

const colorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  gray: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: keyof typeof colorMap;
}

export function Badge({ className, color = 'gray', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        colorMap[color],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
