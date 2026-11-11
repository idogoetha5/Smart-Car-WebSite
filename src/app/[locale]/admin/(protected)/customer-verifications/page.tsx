'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, CreditCard, Eye, EyeOff, Link2, Lock, MessageCircle, Phone, RefreshCw, Search, Send, Trash2, X } from 'lucide-react';
import { BRAND_LABEL, maskCard, type CardBrand } from '@/lib/customer-verification/card';

type Status = 'SENT' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
const STATUS: Record<Status, { label: string; cls: string }> = {
  COMPLETED: { label: 'התקבל', cls: 'bg-brand-600 text-white' },
  SENT: { label: 'ממתין ללקוח', cls: 'bg-amber-100 text-amber-800' },
  EXPIRED: { label: 'פג תוקף', cls: 'bg-gray-100 text-gray-600' },
  CANCELLED: { label: 'בוטל', cls: 'bg-gray-100 text-gray-500' },
};

interface ListRow {
  id: string;
  status: 'SENT' | 'COMPLETED' | 'CANCELLED';
  customer_name: string | null;
  customer_phone: string;
  booking_ref: string | null;
  locale: string;
  expires_at: string;
  completed_at: string | null;
  card_last4: string | null;
  card_brand: string | null;
  card_expiry: string | null;
  created_at: string;
  source?: 'admin' | 'public';
}

interface Detail extends ListRow {
  card_holder_name: string | null;
  card_holder_id_type: string | null;
  consent_at: string | null;
  internal_notes: string | null;
  has_card: boolean;
  files: { licenseFront: string | null; licenseBack: string | null };
  access_log: { action: string; ip: string | null; created_at: string }[];
}

interface Revealed { number: string; expiry: string; holderIdType: string; holderId: string }

const displayStatus = (r: Pick<ListRow, 'status' | 'expires_at'>): Status =>
  r.status === 'SENT' && new Date(r.expires_at) < new Date() ? 'EXPIRED' : r.status;

const heDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
};

const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.startsWith('0') ? `972${d.slice(1)}` : d;
};

const brandLabel = (b: string | null) => (b && b in BRAND_LABEL ? BRAND_LABEL[b as CardBrand] : 'כרטיס');
const groups = (n: string) => n.replace(/(\d{4})(?=\d)/g, '$1 ');

const LOG_LABEL: Record<string, string> = { VIEW: 'צפייה', REVEAL_CARD: 'הצגת מספר מלא', DELETE_CARD: 'מחיקת כרטיס' };

function KV({ k, v, ltr }: { k: string; v?: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{k}</span>
      <span className="break-words text-[15px] font-medium" dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: 'right' } : undefined}>{v || '—'}</span>
    </div>
  );
}

export default function CustomerVerificationsAdminPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notes, setNotes] = useState('');
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [fixedOpen, setFixedOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/customer-verifications', { cache: 'no-store' });
      const json = await res.json();
      setRows(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/customer-verifications', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setRows(j.data ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetch(`/api/admin/customer-verifications/${encodeURIComponent(selected)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) { setDetail(d); setNotes(d.internal_notes ?? ''); } });
    return () => { cancelled = true; };
  }, [selected]);

  // A revealed number disappears from the screen after one minute.
  useEffect(() => {
    if (!revealed) return;
    const id = setTimeout(() => setRevealed(null), 60_000);
    return () => clearTimeout(id);
  }, [revealed]);

  const open = (id: string) => { setSelected(id); setRevealed(null); setConfirmDelete(false); setMsg(''); };

  const filtered = useMemo(() => {
    const q = query.trim().replace(/[-\s]/g, '');
    return rows.filter((r) => {
      if (filter !== 'ALL' && displayStatus(r) !== filter) return false;
      if (!q) return true;
      return [r.id, r.customer_name ?? '', r.customer_phone.replace(/\D/g, ''), r.booking_ref ?? '', r.card_last4 ?? '']
        .some((x) => x.replace(/[-\s]/g, '').includes(q));
    });
  }, [rows, query, filter]);

  const counts = useMemo(() => ({
    COMPLETED: rows.filter((r) => displayStatus(r) === 'COMPLETED').length,
    SENT: rows.filter((r) => displayStatus(r) === 'SENT').length,
  }), [rows]);

  const patch = async (body: Record<string, unknown>) => {
    if (!detail) return false;
    const res = await fetch(`/api/admin/customer-verifications/${encodeURIComponent(detail.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) { setMsg('השמירה נכשלה'); return false; }
    return true;
  };

  const reveal = async () => {
    if (!detail) return;
    if (revealed) { setRevealed(null); return; }
    const res = await fetch(`/api/admin/customer-verifications/${encodeURIComponent(detail.id)}/card`, { method: 'POST' });
    if (!res.ok) { setMsg('לא ניתן להציג את פרטי הכרטיס'); return; }
    setRevealed(await res.json());
  };

  const deleteCard = async () => {
    if (!detail) return;
    const res = await fetch(`/api/admin/customer-verifications/${encodeURIComponent(detail.id)}/card`, { method: 'DELETE' });
    if (!res.ok) { setMsg('המחיקה נכשלה'); return; }
    setRevealed(null); setConfirmDelete(false);
    setDetail({ ...detail, has_card: false });
    setMsg('פרטי הכרטיס נמחקו');
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setMsg('הועתק'); } catch { setMsg('ההעתקה נכשלה'); }
  };

  const shown = selected && detail?.id === selected ? detail : null;
  const btn = 'flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-600';

  return (
    <div className="p-4 md:p-8" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">רישיון ואשראי</h1>
          <p className="text-sm text-gray-500">{counts.COMPLETED} התקבלו · {counts.SENT} ממתינים ללקוח</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSendOpen(true)} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"><Send className="h-4 w-4" />שליחת קישור ללקוח</button>
          <button onClick={() => setFixedOpen(true)} className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold"><Link2 className="h-4 w-4" />קישור קבוע</button>
          <button onClick={() => { setLoading(true); load(); }} aria-label="טעינה מחדש" className="rounded-xl border border-gray-300 bg-white px-3 py-2.5"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_560px]">
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative flex-[1_1_240px]">
              <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי שם, טלפון, הזמנה או 4 ספרות אחרונות"
                className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-3 pr-9 text-sm" />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value as Status | 'ALL')} className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm">
              <option value="ALL">כל הסטטוסים</option>
              {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="border-b border-gray-200 text-xs text-gray-500">
                <tr>{['אסמכתה', 'נשלח', 'לקוח', 'טלפון', 'הזמנה', 'כרטיס', 'סטטוס'].map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">טוען…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">אין רשומות להצגה</td></tr>}
                {filtered.map((r) => {
                  const st = displayStatus(r);
                  return (
                    <tr key={r.id} onClick={() => open(r.id)}
                      className={`cursor-pointer border-b border-gray-100 last:border-0 hover:bg-brand-50 ${selected === r.id ? 'bg-brand-50' : ''}`}>
                      <td className="px-3 py-3" dir="ltr" style={{ textAlign: 'right' }}>{r.id}</td>
                      <td className="px-3 py-3">{heDateTime(r.created_at)}</td>
                      <td className="px-3 py-3">{r.customer_name ?? '—'}{r.source === 'public' && <span className="mr-1.5 whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">קישור קבוע</span>}</td>
                      <td className="px-3 py-3" dir="ltr" style={{ textAlign: 'right' }}>{r.customer_phone}</td>
                      <td className="px-3 py-3">{r.booking_ref ?? '—'}</td>
                      <td className="px-3 py-3" dir="ltr" style={{ textAlign: 'right' }}>{r.card_last4 ? maskCard(r.card_last4) : '—'}</td>
                      <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[st].cls}`}>{STATUS[st].label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {shown && (
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-gray-500">{shown.customer_name ?? 'לקוח'}</div>
                <div className="text-xl font-bold" dir="ltr" style={{ textAlign: 'right' }}>{shown.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[displayStatus(shown)].cls}`}>{STATUS[displayStatus(shown)].label}</span>
                <button onClick={() => setSelected(null)} aria-label="סגירה" className="rounded-lg p-2 hover:bg-gray-100"><X className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href={`https://wa.me/${waNumber(shown.customer_phone)}`} target="_blank" rel="noreferrer" className={btn}><MessageCircle className="h-4 w-4" />וואטסאפ</a>
              <a href={`tel:${shown.customer_phone}`} className={btn}><Phone className="h-4 w-4" />חיוג</a>
              {displayStatus(shown) === 'SENT' && (
                <button onClick={async () => {
                  if (await patch({ status: 'CANCELLED' })) {
                    setRows((p) => p.map((r) => (r.id === shown.id ? { ...r, status: 'CANCELLED' } : r)));
                    setDetail({ ...shown, status: 'CANCELLED' });
                  }
                }} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600">ביטול הקישור</button>
              )}
            </div>

            <section className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
              <KV k="טלפון" v={shown.customer_phone} ltr />
              <KV k="הזמנה" v={shown.booking_ref} />
              <KV k="נשלח" v={heDateTime(shown.created_at)} />
              <KV k={shown.completed_at ? 'התקבל' : 'בתוקף עד'} v={heDateTime(shown.completed_at ?? shown.expires_at)} />
            </section>

            {shown.status === 'COMPLETED' && (
              <>
                <section className="border-t border-gray-100 pt-4">
                  <div className="mb-2 text-xs text-gray-500">רישיון נהיגה</div>
                  <div className="grid grid-cols-2 gap-2">
                    {([['צד קדמי', shown.files.licenseFront], ['צד אחורי', shown.files.licenseBack]] as const).map(([label, url]) => (
                      <button key={label} type="button" onClick={() => url && setZoom(url)} className="flex flex-col gap-1 text-right">
                        <div className="aspect-[1.58] w-full overflow-hidden rounded-lg bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {url ? <img src={url} alt={label} className="h-full w-full object-cover" /> : null}
                        </div>
                        <span className="text-xs text-gray-500">{label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500"><CreditCard className="h-4 w-4" />כרטיס אשראי</div>
                  {shown.has_card ? (
                    <>
                      <div className="rounded-xl bg-[#0D2B2B] p-4 text-white">
                        <div className="text-sm opacity-80">{brandLabel(shown.card_brand)}</div>
                        <div dir="ltr" className="mt-2 text-right text-xl font-bold tracking-widest">{revealed ? groups(revealed.number) : maskCard(shown.card_last4)}</div>
                        <div className="mt-3 flex justify-between text-sm">
                          <span>{shown.card_holder_id_type === 'passport' ? 'דרכון' : 'ת״ז'}: <span dir="ltr">{revealed ? revealed.holderId : '••••••'}</span></span>
                          <span dir="ltr">{shown.card_expiry}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={reveal} className={btn}>{revealed ? <><EyeOff className="h-4 w-4" />הסתרה</> : <><Eye className="h-4 w-4" />הצגת מספר מלא</>}</button>
                        {revealed && <button onClick={() => copy(revealed.number)} className={btn}><Copy className="h-4 w-4" />העתקת מספר</button>}
                        {revealed && <button onClick={() => copy(revealed.holderId)} className={btn}><Copy className="h-4 w-4" />העתקת ת״ז</button>}
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" />כל הצגה של המספר המלא נרשמת. המספר נעלם מהמסך אחרי דקה.</p>
                      {!confirmDelete ? (
                        <button onClick={() => setConfirmDelete(true)} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-red-700"><Trash2 className="h-4 w-4" />מחיקת פרטי הכרטיס</button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                          המחיקה סופית ולא ניתן יהיה לחייב את הכרטיס.
                          <button onClick={deleteCard} className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white">מחיקה</button>
                          <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 font-semibold">ביטול</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">פרטי הכרטיס נמחקו. נשמרו רק הסוג, 4 הספרות האחרונות ({shown.card_last4}) והתוקף.</p>
                  )}
                  <KV k="הסכמת הלקוח לשמירה ולחיוב" v={heDateTime(shown.consent_at)} />
                </section>
              </>
            )}

            {msg && <p className="rounded-lg bg-gray-50 p-2.5 text-sm text-gray-700" role="status">{msg}</p>}

            <section className="flex flex-col gap-1.5 border-t border-gray-100 pt-4">
              <label htmlFor="cv-notes" className="text-sm font-semibold">הערה פנימית</label>
              <textarea id="cv-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                onBlur={() => notes !== (shown.internal_notes ?? '') && patch({ internal_notes: notes }).then((ok) => ok && setDetail({ ...shown, internal_notes: notes }))}
                rows={3} placeholder="למשל: חויב כביש 6 בתאריך…" className="rounded-xl border border-gray-300 p-3 text-sm" />
            </section>

            {shown.access_log.length > 0 && (
              <details className="border-t border-gray-100 pt-4 text-sm">
                <summary className="cursor-pointer text-xs text-gray-500">יומן גישה</summary>
                <ul className="mt-2 flex flex-col gap-1 text-gray-600">
                  {shown.access_log.map((l, i) => (
                    <li key={i}>{heDateTime(l.created_at)} · {LOG_LABEL[l.action] ?? l.action} · <span dir="ltr">{l.ip}</span></li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)} role="dialog" aria-modal="true" aria-label="תמונת רישיון">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="רישיון נהיגה" className="max-h-full max-w-full rounded-lg" />
          <button onClick={() => setZoom(null)} aria-label="סגירה" className="absolute left-4 top-4 rounded-full bg-white/90 p-2"><X className="h-5 w-5" /></button>
        </div>
      )}

      {sendOpen && <SendLinkModal onClose={() => setSendOpen(false)} onCreated={() => load()} />}
      {fixedOpen && <FixedLinksModal onClose={() => setFixedOpen(false)} />}
    </div>
  );
}

function SendLinkModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ phone: '', name: '', bookingRef: '', lang: 'he' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const send = async () => {
    if (form.phone.replace(/\D/g, '').length < 9) { setErr('צריך מספר טלפון של הלקוח'); return; }
    // Open the WhatsApp tab synchronously so the browser does not block it as a pop-up.
    const win = window.open('', '_blank');
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/customer-verifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) { win?.close(); setErr('יצירת הקישור נכשלה'); return; }
    const { token } = await res.json();
    const link = `${window.location.origin}/${form.lang}/customer-verification?t=${token}`;
    const first = form.name.trim().split(/\s+/)[0];
    // Link on its own line, last, so WhatsApp builds the large preview card.
    const msg = form.lang === 'en'
      ? `Hi${first ? ` ${first}` : ''},\nThis is SmartCar. To complete your booking, please photograph your driving licence and add your card details through your personal, encrypted link. It takes about a minute.\n\n${link}`
      : `שלום${first ? ` ${first}` : ''},\nכאן סמארט קאר. כדי להשלים את ההזמנה, נבקש לצלם את רישיון הנהיגה ולמלא את פרטי הכרטיס בקישור האישי והמאובטח. זה לוקח כדקה.\n\n${link}`;
    const url = `https://wa.me/${waNumber(form.phone)}?text=${encodeURIComponent(msg)}`;
    if (win) win.location.href = url; else window.location.href = url;
    onCreated();
    onClose();
  };

  const inp = 'h-11 w-full rounded-xl border border-gray-300 px-3 text-sm font-normal';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="שליחת קישור ללקוח" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">שליחת קישור לרישיון ואשראי</h2>
          <button onClick={onClose} aria-label="סגירה" className="rounded-lg p-2 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-4 text-sm text-gray-500">ייפתח וואטסאפ עם הודעה מוכנה וקישור אישי. הקישור חד־פעמי ובתוקף לחודש.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold">טלפון הלקוח<input dir="ltr" inputMode="tel" className={inp} value={form.phone} onChange={set('phone')} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">שם הלקוח<input className={inp} value={form.name} onChange={set('name')} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">מס׳ הזמנה <span className="font-normal text-gray-400">(לא חובה)</span><input className={inp} value={form.bookingRef} onChange={set('bookingRef')} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">שפת הטופס<select className={inp} value={form.lang} onChange={set('lang')}><option value="he">עברית</option><option value="en">English</option></select></label>
        </div>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <button onClick={send} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-60"><MessageCircle className="h-5 w-5" />{busy ? 'יוצרים קישור…' : 'פתיחת וואטסאפ'}</button>
      </div>
    </div>
  );
}

/** The two permanent links (Hebrew and English). Anyone who opens one fills in name and phone first. */
function FixedLinksModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin.replace('://smartcar', '://www.smartcar') : 'https://www.smartcar.co.il';
  const links = [
    { lang: 'he', label: 'עברית', url: `${origin}/he/customer-verification`,
      text: 'שלום, כאן סמארט קאר. כדי להשלים את ההזמנה, נבקש לצלם את רישיון הנהיגה ולמלא את פרטי הכרטיס בקישור המאובטח. זה לוקח כדקה.' },
    { lang: 'en', label: 'English', url: `${origin}/en/customer-verification`,
      text: 'Hi, this is SmartCar. To complete your booking, please photograph your driving licence and add your card details through this secure link. It takes about a minute.' },
  ];
  const copy = async (s: string, key: string) => {
    try { await navigator.clipboard.writeText(s); setCopied(key); setTimeout(() => setCopied(''), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="קישור קבוע" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">קישור קבוע</h2>
          <button onClick={onClose} aria-label="סגירה" className="rounded-lg p-2 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-4 text-sm text-gray-500">אותו קישור לכל הלקוחות. הלקוח ממלא שם וטלפון, ואחר כך רישיון וכרטיס. הרשומה מופיעה כאן עם התגית &quot;קישור קבוע&quot;. לקישור אישי עם פרטים ממולאים מראש, השתמשו ב&quot;שליחת קישור ללקוח&quot;.</p>
        <div className="flex flex-col gap-3">
          {links.map((l) => (
            <div key={l.lang} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-1 text-sm font-semibold">{l.label}</div>
              <div dir="ltr" className="mb-3 break-all rounded-lg bg-gray-50 px-3 py-2 text-left text-sm text-gray-700">{l.url}</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy(l.url, l.lang)} className="flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-600">
                  <Copy className="h-4 w-4" />{copied === l.lang ? 'הועתק' : 'העתקת קישור'}
                </button>
                <button onClick={() => copy(`${l.text}\n\n${l.url}`, `${l.lang}-msg`)} className="flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-600">
                  <Copy className="h-4 w-4" />{copied === `${l.lang}-msg` ? 'הועתק' : 'העתקת הודעה מלאה'}
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(`${l.text}\n\n${l.url}`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white">
                  <MessageCircle className="h-4 w-4" />וואטסאפ
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
