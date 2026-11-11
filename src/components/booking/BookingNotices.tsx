'use client';

import { getBookingNotices, type BookingNoticeInput } from '@/lib/booking-notices';

export default function BookingNotices({ className = '', ...input }: BookingNoticeInput & { className?: string }) {
  const notices = getBookingNotices(input);
  if (notices.length === 0) return null;
  return (
    <div aria-live="polite" className={`space-y-2 ${className}`} dir={input.isHe ? 'rtl' : 'ltr'}>
      {notices.map(text => (
        <p key={text} role="note" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-start text-sm leading-relaxed text-amber-950 shadow-sm">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0 text-amber-600">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{text}</span>
        </p>
      ))}
    </div>
  );
}
