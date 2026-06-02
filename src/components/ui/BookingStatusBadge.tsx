'use client';

import { Clock, CheckCircle, XCircle, Car, Flag } from 'lucide-react';

export type BookingStatusValue =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CANCELLED_BY_CUSTOMER'
  | 'REJECTED'
  | (string & {});

interface StatusDef {
  heLabel: string;
  enLabel: string;
  className: string;
  Icon: React.ElementType;
}

// Labels shown to the customer on /my-bookings
const CUSTOMER_MAP: Record<string, StatusDef> = {
  PENDING: {
    heLabel: 'ממתין לאישור',
    enLabel: 'Pending',
    className: 'bg-amber-100 text-amber-700',
    Icon: Clock,
  },
  CONFIRMED: {
    heLabel: 'אושר',
    enLabel: 'Confirmed',
    className: 'bg-green-100 text-green-700',
    Icon: CheckCircle,
  },
  ACTIVE: {
    heLabel: 'פעיל',
    enLabel: 'Active',
    className: 'bg-blue-100 text-blue-700',
    Icon: Car,
  },
  COMPLETED: {
    heLabel: 'הושלם',
    enLabel: 'Completed',
    className: 'bg-gray-100 text-gray-600',
    Icon: Flag,
  },
  CANCELLED: {
    heLabel: 'בוטל',
    enLabel: 'Cancelled',
    className: 'bg-red-100 text-red-600',
    Icon: XCircle,
  },
  CANCELLED_BY_CUSTOMER: {
    heLabel: 'בוטל',
    enLabel: 'Cancelled',
    className: 'bg-red-100 text-red-600',
    Icon: XCircle,
  },
  REJECTED: {
    heLabel: 'סורב',
    enLabel: 'Rejected',
    className: 'bg-red-100 text-red-600',
    Icon: XCircle,
  },
};

// Labels shown in the admin panel
const ADMIN_MAP: Record<string, StatusDef> = {
  PENDING: {
    heLabel: 'ממתין לאישור',
    enLabel: 'Pending',
    className: 'bg-amber-100 text-amber-700',
    Icon: Clock,
  },
  CONFIRMED: {
    heLabel: 'אושר',
    enLabel: 'Approved',
    className: 'bg-green-100 text-green-700',
    Icon: CheckCircle,
  },
  ACTIVE: {
    heLabel: 'פעיל',
    enLabel: 'Active',
    className: 'bg-blue-100 text-blue-700',
    Icon: Car,
  },
  COMPLETED: {
    heLabel: 'הושלם',
    enLabel: 'Completed',
    className: 'bg-gray-100 text-gray-600',
    Icon: Flag,
  },
  CANCELLED: {
    heLabel: 'בוטל ע״י הלקוח',
    enLabel: 'Cancelled by customer',
    className: 'bg-red-100 text-red-600',
    Icon: XCircle,
  },
  CANCELLED_BY_CUSTOMER: {
    heLabel: 'בוטל ע״י הלקוח',
    enLabel: 'Cancelled by customer',
    className: 'bg-red-100 text-red-600',
    Icon: XCircle,
  },
  REJECTED: {
    heLabel: 'סורב',
    enLabel: 'Rejected',
    className: 'bg-red-100 text-red-600',
    Icon: XCircle,
  },
};

const FALLBACK: StatusDef = {
  heLabel: 'לא ידוע',
  enLabel: 'Unknown',
  className: 'bg-gray-100 text-gray-500',
  Icon: Clock,
};

interface BookingStatusBadgeProps {
  status: BookingStatusValue;
  locale?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  variant?: 'customer' | 'admin';
}

export function BookingStatusBadge({
  status,
  locale = 'he',
  showIcon = true,
  size = 'sm',
  variant = 'customer',
}: BookingStatusBadgeProps) {
  const map = variant === 'admin' ? ADMIN_MAP : CUSTOMER_MAP;
  const key = status?.toUpperCase?.() ?? status;
  const def = map[key] ?? FALLBACK;
  const { Icon } = def;
  const label = locale === 'he' ? def.heLabel : def.enLabel;
  const padding = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${padding} ${def.className}`}
    >
      {showIcon && <Icon className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />}
      {label}
    </span>
  );
}

export { CUSTOMER_MAP, ADMIN_MAP };
export default BookingStatusBadge;
