'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-gray-50 flex items-center justify-center p-8 font-sans">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">אירעה שגיאה</h1>
          <p className="text-gray-500 mb-6">משהו השתבש. אנו כבר עובדים על תיקון הבעיה.</p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#E8743B] text-white font-bold rounded-xl hover:bg-[#d4632a] transition-colors"
          >
            נסה שנית
          </button>
        </div>
      </body>
    </html>
  );
}
