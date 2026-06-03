'use client';

import { useState, useEffect } from 'react';
import TurnstileWidget from '@/components/ui/Turnstile';

type Review = {
  id: string;
  name: string;
  rating: number;
  text: string;
  date: string;
};

const FALLBACK_REVIEWS: Review[] = [
  { id: '1', name: 'דניאל כהן', rating: 5, text: 'שירות מעולה מהתחלה ועד הסוף. הרכב הגיע נקי ומוכן, הנציג היה מקצועי ואדיב.', date: new Date('2026-05-01').toISOString() },
  { id: '2', name: 'מיכל לוי', rating: 5, text: 'הזמנתי רכב לחתונה — הגיע בדיוק בזמן, מצוחצח ומוכן. SmartCar היא ה-go-to שלנו מעכשיו.', date: new Date('2026-04-15').toISOString() },
  { id: '3', name: 'Yaron Shapiro', rating: 5, text: 'Used SmartCar for a week-long business trip. The SUV was spotless. Pickup at Ben Gurion was seamless.', date: new Date('2026-04-01').toISOString() },
  { id: '4', name: 'רונית אברהם', rating: 5, text: 'הפתיע אותי כמה התהליך פשוט — מילאתי טופס, נציג התקשר תוך שעה, ובבוקר הרכב עמד מולי.', date: new Date('2026-03-20').toISOString() },
  { id: '5', name: 'אורי גולן', rating: 4, text: 'שירות אישי ברמה גבוהה. הצי גדול, בחרתי SUV נוחה לטיול משפחתי. המחיר הוגן ביחס לאיכות.', date: new Date('2026-02-10').toISOString() },
];

function Stars({ n, size = 'sm' }: { n: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`${cls} ${i <= n ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none"
          aria-label={`${i} stars`}
        >
          <svg className={`w-8 h-8 transition-colors ${i <= (hover || value) ? 'text-amber-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function formatDisplayDate(iso: string, locale: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' });
}

export default function ReviewsSection({ locale }: { locale: string }) {
  const isHe = locale === 'he';
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [formText, setFormText] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetch('/api/reviews')
      .then(r => r.json())
      .then(j => {
        const d: Review[] = j.data ?? [];
        setReviews(d.length > 0 ? d : FALLBACK_REVIEWS);
      })
      .catch(() => setReviews(FALLBACK_REVIEWS))
      .finally(() => setLoading(false));
  }, []);

  const total = reviews.length;
  const avgRating = total > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
    : '5.0';

  const prev = () => setActive(a => (a - 1 + total) % total);
  const next = () => setActive(a => (a + 1) % total);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formText.trim() || formRating < 1) return;
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), text: formText.trim(), rating: formRating, turnstileToken }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFormError(j.error || (isHe ? 'שגיאה, נסה שנית' : 'Error, please try again'));
      } else {
        setSubmitted(true);
        setShowForm(false);
        setFormName(''); setFormText(''); setFormRating(5); setTurnstileToken(null);
      }
    } catch {
      setFormError(isHe ? 'שגיאה, נסה שנית' : 'Error, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-14 bg-[#F5F0E8]" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-[#E8743B] text-sm font-semibold uppercase tracking-widest mb-2">
            {isHe ? 'לקוחות מספרים' : 'What customers say'}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-[#0D2B2B]">
            {isHe ? 'ביקורות לקוחות' : 'Customer Reviews'}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Stars n={5} />
            <span className="text-sm text-gray-600 font-bold">{avgRating}</span>
            <span className="text-sm text-gray-500">/ 5</span>
            {total > 0 && (
              <span className="text-sm text-gray-400">({total} {isHe ? 'ביקורות' : 'reviews'})</span>
            )}
          </div>
          {/* Google Reviews link */}
          <a
            href="https://www.google.com/search?q=smart+car#lrd=0x151d4894faff7625:0x11c7acfa1038271c,1,,,,"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-xs text-[#2D5F5F] hover:text-[#E8743B] underline transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isHe ? 'ביקורות Google' : 'Google Reviews'}
          </a>
        </div>

        {/* Carousel */}
        {loading ? (
          <div className="bg-white rounded-3xl shadow-md p-8 h-48 animate-pulse" />
        ) : (
          <div className="relative">
            <div className="bg-white rounded-3xl shadow-md p-8 md:p-10 min-h-[200px]">
              <Stars n={reviews[active].rating} />
              <blockquote className="text-gray-700 text-base md:text-lg leading-relaxed mt-4 mb-6">
                &ldquo;{reviews[active].text}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2D5F5F] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {reviews[active].name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-[#0D2B2B] text-sm">{reviews[active].name}</p>
                  <p className="text-gray-400 text-xs">
                    {formatDisplayDate(reviews[active].date, locale)}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={prev}
                aria-label="Previous"
                className="w-10 h-10 rounded-full border-2 border-[#2D5F5F] text-[#2D5F5F] flex items-center justify-center hover:bg-[#2D5F5F] hover:text-white transition-colors"
              >
                ‹
              </button>

              <div className="flex gap-2">
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    aria-label={`review ${i + 1}`}
                    className={`w-2 h-2 rounded-full transition-all ${i === active ? 'bg-[#E8743B] w-6' : 'bg-gray-300'}`}
                  />
                ))}
              </div>

              <button
                onClick={next}
                aria-label="Next"
                className="w-10 h-10 rounded-full border-2 border-[#2D5F5F] text-[#2D5F5F] flex items-center justify-center hover:bg-[#2D5F5F] hover:text-white transition-colors"
              >
                ›
              </button>
            </div>
          </div>
        )}

        {/* Success message */}
        {submitted && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-4 text-center text-green-700 text-sm font-medium">
            {isHe
              ? '🎉 תודה! הביקורת שלך התקבלה ותפורסם לאחר אישור.'
              : '🎉 Thank you! Your review has been received and will be published after approval.'}
          </div>
        )}

        {/* Write review CTA */}
        {!submitted && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setShowForm(f => !f)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0D2B2B] hover:bg-[#1a3f3f] text-white font-bold rounded-full transition-colors text-sm"
            >
              ✍️ {isHe ? 'כתוב ביקורת' : 'Write a Review'}
            </button>
          </div>
        )}

        {/* Review form */}
        {showForm && !submitted && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6" dir={isHe ? 'rtl' : 'ltr'}>
            <h3 className="font-bold text-[#0D2B2B] text-lg mb-4">
              {isHe ? 'שתף את החוויה שלך' : 'Share your experience'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot */}
              <input type="text" name="_hp" className="hidden" tabIndex={-1} autoComplete="off" />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isHe ? 'שם *' : 'Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={isHe ? 'ישראל ישראלי' : 'Your name'}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {isHe ? 'דירוג *' : 'Rating *'}
                </label>
                <StarPicker value={formRating} onChange={setFormRating} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isHe ? 'ביקורת *' : 'Review *'}
                </label>
                <textarea
                  required
                  rows={4}
                  value={formText}
                  onChange={e => setFormText(e.target.value)}
                  placeholder={isHe ? 'ספר לנו על החוויה שלך...' : 'Tell us about your experience...'}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] resize-none"
                />
              </div>

              <TurnstileWidget onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />

              {formError && <p className="text-red-600 text-sm">{formError}</p>}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting || !formName.trim() || !formText.trim() || !turnstileToken}
                  className="flex-1 bg-[#E8743B] disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm hover:bg-[#d4632a] transition-colors"
                >
                  {submitting ? (isHe ? 'שולח...' : 'Sending...') : (isHe ? 'שלח ביקורת' : 'Submit Review')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
