'use client';

import { useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

function UnsubscribeForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';

  const alreadyDone = searchParams.get('done') === '1';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(
    alreadyDone ? 'done' : 'idle'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div
      className="max-w-xl mx-auto px-4 sm:px-6 py-20"
      dir={isHe ? 'rtl' : 'ltr'}
    >
      <h1 className="text-3xl font-black text-[#0D2B2B] mb-3">
        {isHe ? 'הסרה מרשימת הדיוור' : 'Unsubscribe from marketing email'}
      </h1>

      {status === 'done' ? (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800 text-sm"
        >
          {isHe
            ? 'הבקשה נקלטה. אם הכתובת הייתה רשומה, היא הוסרה מרשימת הדיוור ולא נשלח אליה דיוור פרסומי נוסף.'
            : 'Request received. If the address was subscribed, it has been removed and will not receive further marketing email.'}
        </div>
      ) : (
        <>
          <p className="text-gray-600 text-sm mb-6">
            {isHe
              ? 'הזינו את כתובת הדוא"ל שאיתה נרשמתם, ונסיר אתכם מרשימת הדיוור.'
              : 'Enter the email address you signed up with and we will remove it from our mailing list.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="unsubscribe-email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                {isHe ? 'כתובת דוא"ל' : 'Email address'}
              </label>
              <input
                id="unsubscribe-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
              />
            </div>

            {status === 'error' && (
              <p role="alert" className="text-sm text-red-600">
                {isHe
                  ? 'ההסרה נכשלה. נסו שוב, או פנו אלינו ונסיר אתכם ידנית.'
                  : 'Unsubscribe failed. Please try again, or contact us and we will remove you manually.'}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 bg-[#0D2B2B] disabled:opacity-50 text-white font-bold rounded-xl hover:bg-[#1a3f3f] transition-colors"
            >
              {status === 'loading'
                ? isHe
                  ? 'מסיר...'
                  : 'Removing...'
                : isHe
                ? 'הסר אותי מרשימת הדיוור'
                : 'Unsubscribe me'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#2D5F5F] border-t-transparent rounded-full" />
        </div>
      }
    >
      <UnsubscribeForm />
    </Suspense>
  );
}
