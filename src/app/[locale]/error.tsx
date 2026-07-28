'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = typeof params?.locale === 'string' ? params.locale : 'unknown';
  const isHe = locale === 'he';

  useEffect(() => {
    console.error(error);
    // Without this the boundary swallows the error: console.error alone does
    // not reach Sentry, so failures on the rental and leasing routes never
    // showed up in monitoring. Locale and digest only — no request data.
    Sentry.captureException(error, {
      tags: { boundary: 'locale-error', locale },
      extra: { digest: error.digest },
    });
  }, [error, locale]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        {isHe ? 'אירעה שגיאה' : 'Something went wrong'}
      </h2>
      <p className="text-gray-600 mb-6 max-w-md">
        {isHe
          ? 'אנו מצטערים, אירעה תקלה בטעינת העמוד. נסו שנית.'
          : 'We apologize — something went wrong loading this page. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="bg-[#2D5F5F] hover:bg-[#1A3A3A] text-white px-6 py-2.5 rounded-xl font-semibold transition-colors"
      >
        {isHe ? 'נסה שנית' : 'Try again'}
      </button>
    </div>
  );
}
