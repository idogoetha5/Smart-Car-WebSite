'use client';

import { useState } from 'react';
import { sendNewsletterSubscribeEmail } from '@/lib/emailjs';
import TurnstileWidget from '@/components/ui/Turnstile';

export default function NewsletterSection({ locale }: { locale: string }) {
  const isHe = locale === 'he';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !turnstileToken) return;
    setStatus('loading');
    try {
      await sendNewsletterSubscribeEmail(email.trim().toLowerCase());
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="py-14 bg-[#0D2B2B]" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
        {status === 'success' ? (
          <>
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {isHe ? 'נרשמת בהצלחה!' : "You're in!"}
            </h2>
            <p className="text-[#a0d4d4] text-sm">
              {isHe
                ? 'תהיה הראשון לדעת על מבצעים ועדכונים מ-SmartCar'
                : "You'll be the first to hear about deals and updates from SmartCar"}
            </p>
          </>
        ) : (
          <>
            <div className="inline-block bg-[#E8743B]/20 text-[#E8743B] text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
              {isHe ? 'מבצעים בלעדיים' : 'Exclusive Offers'}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              {isHe ? 'קבל מבצעים ישירות למייל' : 'Exclusive deals, straight to your inbox'}
            </h2>
            <p className="text-[#a0d4d4] text-sm mb-8">
              {isHe
                ? 'הנחות עונתיות, רכבים חדשים בצי ועדכונים — בלי ספאם'
                : 'Seasonal rates, new fleet arrivals, and member-only promotions — zero spam, unsubscribe anytime'}
            </p>

            <div className="flex justify-center mb-4">
              <TurnstileWidget
                onSuccess={setTurnstileToken}
                onError={() => setTurnstileToken(null)}
                onExpire={() => setTurnstileToken(null)}
              />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder={isHe ? 'כתובת האימייל שלך' : 'Your email address'}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#E8743B] text-sm"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-3 bg-[#E8743B] hover:bg-[#d4632a] disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm whitespace-nowrap"
              >
                {status === 'loading'
                  ? (isHe ? 'שולח...' : 'Sending...')
                  : (isHe ? 'הרשם למבצעים' : 'Get Deals')}
              </button>
            </form>

            {status === 'error' && (
              <p className="mt-3 text-red-400 text-xs">
                {isHe ? 'שגיאה בשליחה, נסה שנית' : 'Failed to send, please try again'}
              </p>
            )}

            <p className="mt-4 text-white/30 text-xs">
              {isHe ? 'ללא ספאם. ביטול בכל עת.' : 'No spam. Unsubscribe at any time.'}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
