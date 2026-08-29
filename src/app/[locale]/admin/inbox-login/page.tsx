'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

/**
 * Daniel's entry point for the WhatsApp-inbox trial — a plain 4-digit PIN
 * (see src/app/api/admin/whatsapp/inbox-login) instead of the full admin
 * password+TOTP login, which needs an authenticator app enrolled on Ido's
 * phone. This session can only open /admin/inbox.
 */
export default function InboxLoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const locale = (params?.locale as string) || 'he';

  const handleLogin = async () => {
    if (!pin) return;
    setLoading(true);
    setError(false);

    const res = await fetch('/api/admin/whatsapp/inbox-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      // Full-page navigation so the server re-reads the new session cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/${locale}/admin/inbox`;
    } else {
      setError(true);
      setPin('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0D2B2B] flex items-center justify-center p-4" dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl p-6 sm:p-10 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Image src="/images/logo.png" alt="SmartCar" width={160} height={60} className="object-contain" />
          </div>
          <p className="text-gray-500">כניסה לתיבת הוואטסאפ</p>
        </div>

        <div className="space-y-4">
          <div className="text-right">
            <label htmlFor="inbox-pin" className="block text-sm font-medium text-gray-700 mb-1">קוד כניסה</label>
            <input
              id="inbox-pin"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="0000"
              dir="ltr"
              aria-invalid={error ? true : undefined}
              className="w-full p-3 border-2 border-gray-200 rounded-xl text-center tracking-widest font-bold focus:border-[#2D5F5F] outline-none"
              autoFocus
            />
          </div>

          {error && (
            <p role="alert" className="text-red-500 text-sm text-right">קוד שגוי, נסה שנית</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || pin.length !== 4}
            className="w-full bg-[#E8743B] hover:bg-orange-600 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-lg transition-colors"
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </div>
      </div>
    </div>
  );
}
