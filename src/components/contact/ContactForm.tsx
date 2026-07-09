'use client';

import { useState } from 'react';
import TurnstileWidget from '@/components/ui/Turnstile';

export default function ContactForm({ isHe }: { isHe: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) { setTurnstileError(true); return; }
    setTurnstileError(false);
    setSubmitError(false);
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, message, turnstileToken }),
      });
      if (!res.ok) throw new Error('api');
      setSubmitted(true);
    } catch {
      setSubmitError(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-[#0D2B2B] mb-2">
          {isHe ? 'פנייתך התקבלה!' : 'Message received!'}
        </h3>
        <p className="text-gray-500">
          {isHe ? 'נחזור אליך בהקדם האפשרי' : 'We will get back to you shortly'}
        </p>
        <p className="text-sm text-gray-400 mt-2">📞 09-9509757</p>
        <button
          onClick={() => { setSubmitted(false); setName(''); setPhone(''); setEmail(''); setMessage(''); setTurnstileToken(null); }}
          className="mt-6 text-[#2D5F5F] underline text-sm"
        >
          {isHe ? 'שלח פנייה נוספת' : 'Send another message'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1.5">
            {isHe ? 'שם מלא' : 'Full Name'}
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
          />
        </div>
        <div>
          <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 mb-1.5">
            {isHe ? 'טלפון' : 'Phone'}
          </label>
          <input
            id="contact-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1.5">
          {isHe ? 'דוא"ל' : 'Email'}
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1.5">
          {isHe ? 'הודעה' : 'Message'}
        </label>
        <textarea
          id="contact-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] resize-none"
        />
      </div>

      <div className="flex justify-center">
        <TurnstileWidget
          onSuccess={setTurnstileToken}
          onError={() => setTurnstileToken(null)}
          onExpire={() => setTurnstileToken(null)}
        />
      </div>
      {turnstileError && (
        <p className="text-xs text-red-500 text-center">
          {isHe ? 'יש להשלים את אימות האנטי-בוט' : 'Please complete the anti-bot verification'}
        </p>
      )}

      {submitError && (
        <p className="text-sm text-red-500 text-center">
          {isHe ? 'שגיאה בשליחה, נסה שנית או התקשר אלינו' : 'Error sending message — please try again or call us'}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-[#1B4D3E] disabled:opacity-50 text-white font-semibold rounded-xl hover:bg-[#153d31] transition-colors"
      >
        {loading ? (isHe ? 'שולח...' : 'Sending...') : isHe ? 'שלח' : 'Send Message'}
      </button>
    </form>
  );
}
