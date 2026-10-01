'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

/** "חזרה" — previous screen, or the driver home when opened directly. */
export default function BackButton({ fallback = '/driver' }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="flex min-h-11 items-center gap-1 rounded-full pe-4 ps-2 text-base font-bold text-[#2D5F5F] hover:bg-[#eef6f6]"
    >
      <ChevronRight className="h-5 w-5" aria-hidden="true" />
      חזרה
    </button>
  );
}
