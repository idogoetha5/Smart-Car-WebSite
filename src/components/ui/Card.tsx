import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-sm border border-gray-100',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('px-6 py-4 border-b border-gray-100', className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: CardProps) {
  return <div className={cn('px-6 py-4', className)} {...props} />;
}
