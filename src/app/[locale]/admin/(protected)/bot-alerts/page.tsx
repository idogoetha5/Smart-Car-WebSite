'use client';

import { useState } from 'react';

export default function BotAlertsPage() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  async function testAlert() {
    if (sending) return;
    setSending(true);
    setResult('');
    try {
      const response = await fetch('/api/admin/whatsapp/incident-test', { method: 'POST' });
      const body = await response.json();
      setResult(response.ok && body.data?.accepted === true
        ? 'ספק המייל אישר את השליחה. יש לבדוק שההודעה הגיעה לתיבת המייל, כולל דואר זבל.'
        : 'שליחת הבדיקה לא אושרה. יש לבדוק את הגדרת ההתרעות לפני הסתמכות עליהן.');
    } catch {
      setResult('לא התקבל אישור לשליחה. אפשר לבדוק את תיבת המייל לפני ניסיון נוסף.');
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8" dir="rtl">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-8">
        <h1 className="text-2xl font-bold text-[#0D2B2B]">התרעות הבוט</h1>
        <p className="mt-3 text-base leading-7 text-slate-700">אפשר לשלוח הודעת בדיקה לכתובת המנהל שהוגדרה. ההודעה אינה כוללת פרטי לקוחות ואינה נשלחת ללקוחות.</p>
        <button type="button" disabled={sending} onClick={testAlert} className="mt-5 min-h-12 w-full rounded-2xl bg-[#2D5F5F] px-5 py-3 text-base font-bold text-white disabled:opacity-60 sm:w-auto">
          {sending ? 'שולח בדיקה…' : 'שליחת התרעת בדיקה'}
        </button>
        <p role="status" aria-live="polite" className="mt-4 text-base leading-7 text-slate-700">{result}</p>
        <p className="mt-5 text-sm leading-6 text-slate-600">בדיקה זו מאמתת רק את מסלול המייל. היא אינה בודקת התאוששות מתקלות או ניטור חיצוני של האתר. בקשות חוזרות באותו חלון של רבע שעה עשויות להפיק הודעה אחת בלבד.</p>
      </section>
    </div>
  );
}
