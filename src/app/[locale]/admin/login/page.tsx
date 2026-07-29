'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  // Revealed only once the server says a code is needed, so the field does not
  // confuse anyone before TOTP is enrolled.
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState<null | 'password' | 'totp'>(null);
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const locale = (params?.locale as string) || 'he';

  const handleLogin = async () => {
    if (!password) return;
    setLoading(true);
    setError(null);

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, totp }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      window.location.href = `/${locale}/admin`;
    } else if (data.error === 'totp_required') {
      // Password was right; the account has a second factor enrolled.
      setTotpRequired(true);
      setError(null);
    } else if (data.error === 'totp_invalid') {
      setTotpRequired(true);
      setTotp('');
      setError('totp');
    } else {
      setError('password');
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
          <p className="text-gray-500">כניסה למערכת ניהול</p>
        </div>

        <div className="space-y-4">
          <div className="text-right">
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="הזן סיסמה..."
              className="w-full p-3 border-2 border-gray-200 rounded-xl text-right focus:border-[#2D5F5F] outline-none"
              autoFocus
            />
          </div>

          {totpRequired && (
            <div className="text-right">
              <label htmlFor="admin-totp" className="block text-sm font-medium text-gray-700 mb-1">
                קוד אימות מהאפליקציה
              </label>
              <input
                id="admin-totp"
                name="one-time-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="123456"
                dir="ltr"
                aria-invalid={error === 'totp' ? true : undefined}
                aria-describedby={error === 'totp' ? 'admin-totp-error' : undefined}
                className="w-full p-3 border-2 border-gray-200 rounded-xl text-center tracking-widest font-bold focus:border-[#2D5F5F] outline-none"
                autoFocus
              />
              <p className="text-gray-500 text-xs mt-1">
                הקוד בן 6 הספרות מ-Google Authenticator
              </p>
            </div>
          )}

          {error === 'password' && (
            <p role="alert" className="text-red-500 text-sm text-right">סיסמה שגויה, נסה שנית</p>
          )}
          {error === 'totp' && (
            <p id="admin-totp-error" role="alert" className="text-red-500 text-sm text-right">
              קוד אימות שגוי או שפג תוקפו, נסה שנית
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !password || (totpRequired && totp.length !== 6)}
            className="w-full bg-[#E8743B] hover:bg-orange-600 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-lg transition-colors"
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </div>
      </div>
    </div>
  );
}
