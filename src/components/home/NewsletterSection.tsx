'use client';

import { useState } from 'react';
import TurnstileWidget from '@/components/ui/Turnstile';

// Exact consent wording shown to the user. Stored alongside the
// subscription so we can prove later what was agreed to, and versioned so
// a future change to the wording is distinguishable.
// Bumped when MARKETING_CONSENT_TEXT changes, so a ledger row always
// identifies which wording was actually shown.
const MARKETING_CONSENT_VERSION = '1.1';
// Stored verbatim in the consent ledger, so this is the exact sentence the
// subscriber saw. Changing it here changes what the ledger proves.
const MARKETING_CONSENT_TEXT = {
  he: 'אני מאשר/ת לקבל מ־SmartCar עדכונים והצעות בדוא״ל. אפשר לבטל את ההרשמה בכל עת.',
  en: 'I agree to receive updates and offers from SmartCar by email. I can unsubscribe at any time.',
} as const;

export default function NewsletterSection({ locale }: { locale: string }) {
  const isHe = locale === 'he';
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !turnstileToken || !consent) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          turnstileToken,
          consent: true,
          consentText: MARKETING_CONSENT_TEXT[isHe ? 'he' : 'en'],
          consentVersion: MARKETING_CONSENT_VERSION,
          locale: isHe ? 'he' : 'en',
          source: 'newsletter_section',
        }),
      });
      if (!res.ok) throw new Error('api');
      setStatus('success');
      setEmail('');
      setConsent(false);
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
              {isHe ? 'ההרשמה הושלמה' : 'You are subscribed'}
            </h2>
            <p className="text-[#a0d4d4] text-sm">
              {isHe
                ? 'ההרשמה הושלמה. שלחנו הודעת אישור לכתובת שהזנת.'
                : 'Your subscription is complete. We have sent a confirmation message to the address you entered.'}
            </p>
          </>
        ) : (
          <>
            <div className="inline-block bg-[#C24E17]/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
              {isHe ? 'עדכונים והצעות' : 'Updates and offers'}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              {isHe ? 'עדכונים והצעות מ־SmartCar' : 'Updates and offers from SmartCar'}
            </h2>
            <p className="text-[#a0d4d4] text-sm mb-8">
              {isHe
                ? 'קבלו עדכונים על רכבים שנוספו לצי והצעות תקופתיות.'
                : 'Receive updates about vehicles added to the fleet and periodic offers.'}
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
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                aria-label={isHe ? 'כתובת האימייל שלך' : 'Your email address'}
                placeholder={isHe ? 'כתובת האימייל שלך' : 'Your email address'}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#E8743B] text-sm"
              />
              <button
                type="submit"
                disabled={status === 'loading' || !consent}
                className="px-6 py-3 bg-[#C24E17] hover:bg-[#d4632a] disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm whitespace-nowrap"
              >
                {status === 'loading'
                  ? (isHe ? 'שולח...' : 'Sending...')
                  : (isHe ? 'הרשמה לעדכונים' : 'Subscribe to updates')}
              </button>
            </form>

            <label className="flex items-start gap-2 max-w-md mx-auto mt-4 text-start cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[#C24E17] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0D2B2B]"
              />
              <span className="text-white/80 text-xs leading-relaxed">
                {MARKETING_CONSENT_TEXT[isHe ? 'he' : 'en']}
              </span>
            </label>

            {status === 'error' && (
              <p className="mt-3 text-red-400 text-xs">
                {isHe ? 'שגיאה בשליחה, נסה שנית' : 'Failed to send, please try again'}
              </p>
            )}

            <p className="mt-4 text-white/70 text-xs">
              {''}
              <a
                href={`/${isHe ? 'he' : 'en'}/unsubscribe`}
                className="underline hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0D2B2B] rounded"
              >
                {isHe ? 'להסרה מרשימת הדיוור' : 'Unsubscribe at any time'}
              </a>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
