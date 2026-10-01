'use client';

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { Plus, Trash2, Download, MessageCircle, Send } from 'lucide-react';

const A4_W = 794;
const A4_H = 1123;
import {
  quoteHeadHTML,
  quoteBodyHTML,
  generateQuoteNumber,
  todayIL,
  emptyVehicle,
  type QuoteData,
  type QuoteVehicle,
} from '@/lib/quote-pdf';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InventoryVehicle = any;

const DEFAULT_INCLUDED_HE = [
  'זמינות מיידית של הרכב — במלאי',
  'החלפת 4 צמיגים בגין בלאי, מצבר וסט מגבים',
  'טיפולים שוטפים לפי הוראות יצרן במוסכים מורשים',
  'אגרת רישוי שנתית',
  'רכב חליפי במקרה של תקלה או תאונה',
  'אופציית רכישה: 16% הנחה ממחירון יבואן',
  'כיסוי ביטוחי מורחב לפי תנאי ההסכם',
].join('\n');

const DEFAULT_INCLUDED_EN = [
  'Immediate vehicle availability — in stock',
  'Replacement of 4 tires due to wear, battery, and wiper blades',
  'Routine maintenance per manufacturer guidelines at authorized service centers',
  'Annual vehicle registration fee',
  'Replacement vehicle in case of breakdown or accident',
  'Purchase option: 16% discount from list price',
  'Comprehensive insurance coverage as per agreement terms',
].join('\n');

const DEFAULT_TERMS_HE = [
  'המחיר החודשי צמוד למדד המחירים לצרכן',
  'תשלום חודשי בהוראת קבע',
  'השתתפות עצמית <span class="num">2,500 &#8362;</span> + מע"מ',
  'חריגת ק"מ: <span class="num">0.5 &#8362;</span> בתוספת מע"מ לק"מ',
].join('\n');

const DEFAULT_TERMS_EN = [
  'Monthly payment is linked to the Consumer Price Index (CPI)',
  'Monthly payment via direct debit',
  'Deductible of <span class="num">2,500 &#8362;</span> + VAT',
  'Mileage overage: <span class="num">0.5 &#8362;</span> + VAT per km',
].join('\n');

export default function AdminQuotesPage() {
  return <LeasingQuoteBuilder />;
}

export function LeasingQuoteBuilder({ loginUrl = '/he/admin/login' }: { loginUrl?: string }) {
  // Stable for the whole builder session — every save/PDF/send while editing
  // this one draft reuses it, so they update the same row. A fresh page load
  // (a genuinely new quotation) always gets a fresh id, even if the display
  // number below happens to repeat or the customer email is identical to an
  // earlier quote. See src/lib/quote-history.ts for why this must never be
  // the display number or the customer's email.
  const [quoteId] = useState(() => crypto.randomUUID());
  const [quoteNumber] = useState(generateQuoteNumber());
  const [date] = useState(todayIL());
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [vehicles, setVehicles] = useState<QuoteVehicle[]>([emptyVehicle()]);
  const [inventory, setInventory] = useState<InventoryVehicle[]>([]);
  
  const [includedTerms, setIncludedTerms] = useState(DEFAULT_INCLUDED_HE);
  const [additionalTerms, setAdditionalTerms] = useState(DEFAULT_TERMS_HE);
  const [footerNote, setFooterNote] = useState('');
  const [isBinding, setIsBinding] = useState(false);

  const changeLanguage = (nextLanguage: 'he' | 'en') => {
    setLanguage(nextLanguage);
    setIncludedTerms((current) => nextLanguage === 'en' && current === DEFAULT_INCLUDED_HE
      ? DEFAULT_INCLUDED_EN
      : nextLanguage === 'he' && current === DEFAULT_INCLUDED_EN
        ? DEFAULT_INCLUDED_HE
        : current);
    setAdditionalTerms((current) => nextLanguage === 'en' && current === DEFAULT_TERMS_HE
      ? DEFAULT_TERMS_EN
      : nextLanguage === 'he' && current === DEFAULT_TERMS_EN
        ? DEFAULT_TERMS_HE
        : current);
  };
  
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [busy, setBusy] = useState<'pdf' | 'send' | 'whatsapp' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  useLayoutEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const update = () => setPreviewScale(Math.min(1, el.clientWidth / A4_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    fetch('/api/admin/vehicles')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setInventory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const quoteData: QuoteData = useMemo(() => ({
    id: quoteId,
    quoteNumber,
    date,
    customerName,
    customerPhone,
    customerEmail,
    companyName,
    companyId,
    vehicles,
    language,
    includedTerms: includedTerms.split('\n').map(s => s.trim()).filter(Boolean),
    additionalTerms: additionalTerms.split('\n').map(s => s.trim()).filter(Boolean),
    footerNote: footerNote.trim() || undefined,
    isBinding,
  }), [quoteId, quoteNumber, date, customerName, customerPhone, customerEmail, companyName, companyId, vehicles, language, includedTerms, additionalTerms, footerNote, isBinding]);

  // Stable shell (fonts + styles) rendered once so the iframe never reloads;
  // the body is written live on every edit for an instant, flicker-free preview.
  const previewShell = useMemo(
    () => `<!DOCTYPE html><html><head><meta charset="UTF-8">${quoteHeadHTML()}</head><body></body></html>`,
    []
  );
  const bodyHTML = useMemo(() => quoteBodyHTML(quoteData), [quoteData]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Write the quote body into the preview iframe once the font/style shell
  // has loaded, then on every edit. Polls via rAF instead of relying on the
  // iframe load event, which doesn't fire reliably for srcDoc in React.
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const write = () => {
      if (cancelled) return;
      const doc = iframeRef.current?.contentDocument;
      if (doc?.body && doc.head?.querySelector('style')) {
        doc.documentElement.lang = language === 'en' ? 'en' : 'he';
        doc.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
        doc.body.innerHTML = bodyHTML;
      } else {
        raf = requestAnimationFrame(write);
      }
    };
    write();
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [bodyHTML, language]);

  const updateVehicle = (i: number, patch: Partial<QuoteVehicle>) => {
    setVehicles((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };

  const applyFromInventory = (i: number, vehicleId: string) => {
    const v = inventory.find((iv) => iv.id === vehicleId);
    if (!v) return;
    updateVehicle(i, {
      name: `${v.make} ${v.model}`,
      year: String(v.year ?? ''),
      // Monthly lease price + the car photo auto-fill from inventory.
      // מחירון יבואן / מקדמה are leasing-catalog figures not stored on the
      // vehicle, so they stay for manual entry.
      monthlyPrice: Number(v.price_per_month) || 0,
      imageUrl: Array.isArray(v.image_urls) ? v.image_urls[0] ?? '' : '',
    });
  };

  const addVehicle = () => setVehicles((prev) => [...prev, emptyVehicle()]);
  const removeVehicle = (i: number) => setVehicles((prev) => prev.filter((_, idx) => idx !== i));

  async function fetchPdf(): Promise<Blob | null> {
    setError('');
    setSuccess('');
    const res = await fetch('/api/admin/quote-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteData),
    });
    if (res.status === 401) {
      setError('ההתחברות שלך פגה — מעביר אותך לדף ההתחברות...');
      // Full-page navigation is intentional after an authentication state change,
      // so the server re-reads the updated session cookie.
      setTimeout(() => { window.location.href = loginUrl; }, 1200);
      return null;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'יצירת ה-PDF נכשלה, נסה שוב');
      return null;
    }
    return res.blob();
  }

  function downloadBlob(blob: Blob) {
    const safe = (customerName || 'Client').replace(/[\s/\\]/g, '_');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartCar_Quote_${safe}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const handleDownload = async () => {
    setBusy('pdf');
    const blob = await fetchPdf();
    if (blob) downloadBlob(blob);
    setBusy(null);
  };

  const handleSend = async () => {
    if (!customerEmail) {
      setError('יש להזין כתובת מייל של הלקוח כדי לשלוח');
      setSuccess('');
      return;
    }

    setBusy('send');
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/quote-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData),
      });

      if (res.status === 401) {
        setError('ההתחברות שלך פגה — מעביר אותך לדף ההתחברות...');
        // Full-page navigation is intentional after an authentication state change,
        // so the server re-reads the updated session cookie.
        setTimeout(() => { window.location.href = loginUrl; }, 1200);
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'שליחת הצעת המחיר נכשלה, נסה שוב');
        return;
      }

      setSuccess(`הצעת המחיר נשלחה בהצלחה ל־${customerEmail}`);
    } catch {
      setError('לא ניתן היה לשלוח את הצעת המחיר כרגע, נסה שוב');
    } finally {
      setBusy(null);
    }
  };

  const handleWhatsApp = async () => {
    if (!customerName.trim() || !customerPhone.trim() || !vehicles.some((vehicle) => vehicle.name.trim())) {
      setError('יש למלא שם לקוח, מספר WhatsApp ולפחות רכב אחד');
      setSuccess('');
      return;
    }

    const whatsappWindow = window.open('', '_blank');
    setBusy('whatsapp');
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/quote-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData),
      });
      if (response.status === 401) {
        whatsappWindow?.close();
        setError('ההתחברות שלך פגה — מעביר אותך לדף ההתחברות...');
        window.setTimeout(() => { window.location.href = loginUrl; }, 1_200);
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.whatsappUrl) {
        whatsappWindow?.close();
        setError(body.error || 'לא ניתן היה להכין את ההודעה ל-WhatsApp');
        return;
      }
      if (whatsappWindow) {
        whatsappWindow.opener = null;
        whatsappWindow.location.href = body.whatsappUrl;
      } else {
        window.location.href = body.whatsappUrl;
      }
    } catch {
      whatsappWindow?.close();
      setError('לא ניתן היה להכין את ההודעה ל-WhatsApp');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] p-0 sm:p-4 lg:p-8" dir="rtl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">הצעת מחיר ליסינג</h1>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select 
            value={language}
            onChange={(e) => changeLanguage(e.target.value as 'he' | 'en')}
            className="min-h-11 rounded-xl border border-gray-300 bg-white px-3 text-base font-medium"
          >
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
          <button
            onClick={handleDownload}
            disabled={busy !== null}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {busy === 'pdf' ? 'מכין...' : 'PDF'}
          </button>
          <button
            onClick={handleSend}
            disabled={busy !== null}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2D5F5F] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {busy === 'send' ? 'מכין...' : 'שלח'}
          </button>
          <button
            onClick={handleWhatsApp}
            disabled={busy !== null}
            className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17a857] px-4 text-sm font-bold text-white disabled:opacity-50 sm:col-span-1"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {busy === 'whatsapp' ? 'מכין קישור…' : 'WhatsApp'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {success && (
        <div role="status" aria-live="polite" className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Preview — true A4 page scaled to fit the panel, so the whole quote
            is always visible and updates live as the form is edited. */}
        <div className="lg:sticky lg:top-6 rounded-xl bg-gray-200/60 p-4">
          <div ref={previewWrapRef} className="w-full">
            <div
              dir="ltr"
              className="relative mx-auto overflow-hidden rounded-lg bg-white"
              style={{ width: A4_W * previewScale, height: A4_H * previewScale, boxShadow: '0 12px 34px rgba(0,0,0,.14)' }}
            >
              <iframe
                ref={iframeRef}
                title="תצוגה מקדימה"
                srcDoc={previewShell}
                scrolling="no"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: A4_W,
                  height: A4_H,
                  border: 'none',
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right: form */}
        <div className="space-y-5 lg:max-h-[80vh] lg:overflow-y-auto lg:pe-1">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-bold text-gray-900 mb-3">פרטי הצעה</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="תאריך" value={date} readOnly />
              <Field label="מספר הצעה" value={quoteNumber} readOnly />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-bold text-gray-900 mb-3">פרטי לקוח</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="שם לקוח" value={customerName} onChange={setCustomerName} />
              <Field label="טלפון ל-WhatsApp" value={customerPhone} onChange={setCustomerPhone} type="tel" highlight />
              <Field label="מייל לקוח" value={customerEmail} onChange={setCustomerEmail} type="email" highlight />
              <Field label="ת.פ / ע.מ" value={companyId} onChange={setCompanyId} />
              <Field label="שם חברה" value={companyName} onChange={setCompanyName} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">רכבים</h2>
              <button onClick={addVehicle} className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-[#2D5F5F] transition-colors hover:bg-[#edf5f4]">
                <Plus className="w-4 h-4" /> הוסף רכב
              </button>
            </div>

            {vehicles.map((v, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">{v.name || `רכב ${i + 1}`}</h3>
                  {vehicles.length > 1 && (
                    <button onClick={() => removeVehicle(i)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <label className="block text-xs text-gray-500 mb-1">בחר מהמאגר (אופציונלי)</label>
                <select
                  onChange={(e) => applyFromInventory(i, e.target.value)}
                  defaultValue=""
                  className="mb-3 min-h-12 w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
                >
                  <option value="">— בחירה ידנית —</option>
                  {inventory.map((iv) => (
                    <option key={iv.id} value={iv.id}>{iv.make} {iv.model} {iv.year}</option>
                  ))}
                </select>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="שם רכב" value={v.name} onChange={(val) => updateVehicle(i, { name: val })} />
                  <Field label="תת-כותרת" value={v.subtitle} onChange={(val) => updateVehicle(i, { subtitle: val })} />
                  <Field label="רמת גימור" value={v.trim} onChange={(val) => updateVehicle(i, { trim: val })} />
                  <Field label="שנת דגם" value={v.year} onChange={(val) => updateVehicle(i, { year: val })} />
                  <Field label="מס' חודשים" value={String(v.months)} onChange={(val) => updateVehicle(i, { months: Number(val) || 0 })} type="number" />
                  <Field label="ק״מ לשנה" value={String(v.annualKm)} onChange={(val) => updateVehicle(i, { annualKm: Number(val) || 0 })} type="number" />
                  <Field label="מחירון יבואן ₪" value={String(v.listPrice)} onChange={(val) => updateVehicle(i, { listPrice: Number(val) || 0 })} type="number" />
                  <Field label="מקדמה כולל מע״מ ₪" value={String(v.downPayment)} onChange={(val) => updateVehicle(i, { downPayment: Number(val) || 0 })} type="number" />
                  <Field label="חודשי לפני מע״מ ₪" value={String(v.monthlyPrice)} onChange={(val) => updateVehicle(i, { monthlyPrice: Number(val) || 0 })} type="number" />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)} 
              className="w-full flex items-center justify-between text-gray-900 font-bold"
            >
              <span>התאמה אישית של טקסטים בהצעה (אופציונלי)</span>
              <span className="text-gray-400">{showAdvanced ? '▲' : '▼'}</span>
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-gray-500">
                  ערוך את הטקסטים לפי הצורך. כל שורה תוצג כסעיף נפרד במסמך.
                  אם תמחק את כל התוכן, לא יופיעו סעיפים.
                  ניתן להשתמש בתגיות HTML בסיסיות (כמו &lt;b&gt; ו-&lt;span class=&quot;num&quot;&gt;).
                </p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ההצעה כוללת (כל שורה = סעיף עם V)</label>
                  <textarea 
                    value={includedTerms}
                    onChange={e => setIncludedTerms(e.target.value)}
                    className="h-32 w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
                    placeholder="הזן סעיפים..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">תנאים נוספים (כל שורה = סעיף עם נקודה)</label>
                  <textarea 
                    value={additionalTerms}
                    onChange={e => setAdditionalTerms(e.target.value)}
                    className="h-32 w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
                    placeholder="הזן תנאים..."
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-500">הערה בתחתית ההצעה (טקסט חופשי)</label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isBinding}
                        onChange={e => setIsBinding(e.target.checked)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      הפוך להסכם מחייב
                    </label>
                  </div>
                  <textarea 
                    value={footerNote}
                    onChange={e => setFooterNote(e.target.value)}
                    className="h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
                    placeholder="השאר ריק כדי להשתמש בטקסט ברירת המחדל (ההצעה בתוקף עד...)"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', readOnly = false, highlight = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`min-h-12 w-full rounded-xl border px-3 text-base ${
          readOnly ? 'bg-gray-50 border-gray-200 text-gray-500' : 'border-gray-300'
        } ${highlight ? 'bg-yellow-50 border-yellow-300' : ''}`}
      />
    </div>
  );
}
