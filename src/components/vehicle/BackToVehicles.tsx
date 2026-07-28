'use client';

import { useRouter } from 'next/navigation';

/**
 * Returns to the listing the customer came from.
 *
 * Uses history.back() rather than a plain link so the previous screen is
 * restored exactly as it was — the chosen dates, locations and filters all
 * live in that URL's query string, and a hard link to /rental would drop
 * them and make the customer re-enter everything.
 *
 * Falls back to the rental listing when there is no in-app history to go
 * back to (opened in a new tab, arrived from a search engine, or landed
 * here as the first page of the session).
 */
export default function BackToVehicles({ locale }: { locale: string }) {
  const router = useRouter();
  const isHe = locale === 'he';

  // Decided at click time rather than held in state: it needs no render and
  // reading it during an effect only to store it would make the component
  // re-render for nothing.
  const handleClick = () => {
    let sameOriginReferrer = false;
    try {
      sameOriginReferrer =
        document.referrer !== '' &&
        new URL(document.referrer).origin === window.location.origin;
    } catch {
      // Malformed referrer — treat as "not ours" and use the fallback.
    }

    if (window.history.length > 1 && sameOriginReferrer) router.back();
    else router.push(`/${locale}/rental`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 mb-6 text-sm font-semibold text-[#2D5F5F] hover:text-[#B64916] transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] focus-visible:ring-offset-2"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`w-4 h-4 ${isHe ? 'rotate-180' : ''}`}
        aria-hidden="true"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {isHe ? 'חזרה לרכבים' : 'Back to vehicles'}
    </button>
  );
}
