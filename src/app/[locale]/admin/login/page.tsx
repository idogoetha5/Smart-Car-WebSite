'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'he';

  const handleLogin = async () => {
    if (!password) return;
    setLoading(true);
    setError(false);

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      window.location.href = `/${locale}/admin`;
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0D2B2B] flex items-center justify-center" dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl p-10 w-full max-w-md shadow-2xl">
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

          {error && (
            <p className="text-red-500 text-sm text-right">סיסמה שגויה, נסה שנית</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !password}
            className="w-full bg-[#E8743B] hover:bg-orange-600 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-lg transition-colors"
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </div>
      </div>
    </div>
  );
}
