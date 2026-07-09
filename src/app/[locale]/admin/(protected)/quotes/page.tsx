'use client';

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { Plus, Trash2, Download, Send } from 'lucide-react';

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

export default function AdminQuotesPage() {
  const [quoteNumber] = useState(generateQuoteNumber());
  const [date] = useState(todayIL());
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [vehicles, setVehicles] = useState<QuoteVehicle[]>([emptyVehicle()]);
  const [inventory, setInventory] = useState<InventoryVehicle[]>([]);
  const [busy, setBusy] = useState<'pdf' | 'send' | null>(null);
  const [error, setError] = useState('');
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
    quoteNumber,
    date,
    customerName,
    customerEmail,
    companyName,
    companyId,
    vehicles,
  }), [quoteNumber, date, customerName, customerEmail, companyName, companyId, vehicles]);

  // Stable shell (fonts + styles) rendered once so the iframe never reloads;
  // the body is written live on every edit for an instant, flicker-free preview.
  const previewShell = useMemo(
    () => `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">${quoteHeadHTML()}</head><body></body></html>`,
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
        doc.body.innerHTML = bodyHTML;
      } else {
        raf = requestAnimationFrame(write);
      }
    };
    write();
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [bodyHTML]);

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
    const res = await fetch('/api/admin/quote-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteData),
    });
    if (res.status === 401) {
      setError('ההתחברות שלך פגה — מעביר אותך לדף ההתחברות...');
      setTimeout(() => { window.location.href = '/he/admin/login'; }, 1200);
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
      return;
    }
    setBusy('send');
    const blob = await fetchPdf();
    if (blob) {
      downloadBlob(blob);
      const subject = encodeURIComponent('SmartCar - הצעת מחיר');
      const body = encodeURIComponent(
        `שלום ${customerName},\n\n` +
        `מצורפת הצעת המחיר שביקשת מסמארטקאר (קובץ ה-PDF שהורד כרגע — יש לצרף אותו כאן).\n` +
        `לכל שאלה אנחנו זמינים.\n\n` +
        `סמארטקאר — השכרת רכב עד בית הלקוח\n` +
        `www.smartcar.co.il | 09-9509757`
      );
      window.open(`mailto:${customerEmail}?subject=${subject}&body=${body}`, '_self');
    }
    setBusy(null);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">בניית הצעת מחיר</h1>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {busy === 'pdf' ? 'מכין...' : 'PDF'}
          </button>
          <button
            onClick={handleSend}
            disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2 bg-[#2D5F5F] text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {busy === 'send' ? 'מכין...' : 'שלח'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Preview — true A4 page scaled to fit the panel, so the whole quote
            is always visible and updates live as the form is edited. */}
        <div className="lg:sticky lg:top-6 rounded-xl bg-gray-200/60 p-4">
          <div ref={previewWrapRef} className="w-full">
            <div
              className="mx-auto overflow-hidden rounded-lg bg-white"
              style={{ width: A4_W * previewScale, height: A4_H * previewScale, boxShadow: '0 12px 34px rgba(0,0,0,.14)' }}
            >
              <iframe
                ref={iframeRef}
                title="תצוגה מקדימה"
                srcDoc={previewShell}
                scrolling="no"
                style={{
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
        <div className="space-y-5 overflow-y-auto pr-1" style={{ maxHeight: '80vh' }}>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-bold text-gray-900 mb-3">פרטי הצעה</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="תאריך" value={date} readOnly />
              <Field label="מספר הצעה" value={quoteNumber} readOnly />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-bold text-gray-900 mb-3">פרטי לקוח</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="שם לקוח" value={customerName} onChange={setCustomerName} />
              <Field label="מייל לקוח" value={customerEmail} onChange={setCustomerEmail} type="email" highlight />
              <Field label="ת.פ / ע.מ" value={companyId} onChange={setCompanyId} />
              <Field label="שם חברה" value={companyName} onChange={setCompanyName} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">רכבים</h2>
              <button onClick={addVehicle} className="flex items-center gap-1 text-sm font-bold text-[#2D5F5F]">
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
                  className="w-full mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— בחירה ידנית —</option>
                  {inventory.map((iv) => (
                    <option key={iv.id} value={iv.id}>{iv.make} {iv.model} {iv.year}</option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3">
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
        className={`w-full border rounded-lg px-3 py-2 text-sm ${
          readOnly ? 'bg-gray-50 border-gray-200 text-gray-500' : 'border-gray-300'
        } ${highlight ? 'bg-yellow-50 border-yellow-300' : ''}`}
      />
    </div>
  );
}
