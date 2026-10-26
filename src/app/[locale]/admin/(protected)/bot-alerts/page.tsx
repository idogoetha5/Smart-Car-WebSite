'use client';

import { useEffect, useState } from 'react';

type PendingDelivery = { phone: string; status: string; updated_at: string };

export default function BotAlertsPage() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [pending, setPending] = useState<PendingDelivery[]>([]);
  const [pendingError, setPendingError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/admin/whatsapp/delivery-attention', { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('unavailable'); return response.json(); })
      .then(body => { if (active) setPending(body.data ?? []); })
      .catch(() => { if (active) setPendingError(true); });
    return () => { active = false; };
  }, []);
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
      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-8" aria-label="הודעות הדורשות בדיקה">
        <h2 className="text-xl font-bold text-[#0D2B2B]">הודעות שדורשות בדיקה</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">במקרה של תוצאה לא ודאית אין לשלוח שוב אוטומטית; בדקו בתיבת השיחות ובמערכת הספק אם התשובה נמסרה.</p>
        {pendingError ? <p className="mt-4 text-sm text-red-800">לא ניתן לטעון כעת את מצב ההודעות.</p> : pending.length === 0 ? <p className="mt-4 text-sm text-slate-600">אין הודעות ממתינות לבדיקה.</p> : (
          <ul className="mt-4 divide-y divide-slate-100">
            {pending.map((item, index) => <li key={`${item.phone}-${item.updated_at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span className="font-medium text-[#0D2B2B]" dir="ltr">{item.phone}</span>
              <span className="text-slate-600">{item.status === 'uncertain' || item.status === 'sending' ? 'מסירה לא ודאית' : item.status === 'rejected' ? 'שליחה נדחתה' : 'ממתין לעיבוד'}</span>
              <span className="text-xs text-slate-500">{new Date(item.updated_at).toLocaleString('he-IL')}</span>
            </li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
